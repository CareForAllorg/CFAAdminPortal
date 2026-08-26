import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.generated.js';

export interface ProfileDelta {
  buildings: number;
  km: number;
}

// Deletes every service_logs row an attendance-CSV upload previously
// credited for this mapathon date, and returns the negative delta each
// affected member's profile totals need (buildings_mapped/km_roads_mapped
// are additive across mapathons over time -- see uploads.ts's
// uploadMapathonAttendance -- so removing a date's credit means
// subtracting exactly what it added, not just deleting the rows).
export async function reverseMapathonCredits(
  supabase: SupabaseClient<Database>,
  dateId: string
): Promise<Map<string, ProfileDelta>> {
  const { data: priorRows, error: priorError } = await supabase
    .from('service_logs')
    .select('user_id, impact_magnitude, secondary_impact_magnitude')
    .eq('mapathon_date_id', dateId);
  if (priorError) { throw priorError; }

  const { error: deleteError } = await supabase.from('service_logs').delete().eq('mapathon_date_id', dateId);
  if (deleteError) { throw deleteError; }

  const deltaByUser = new Map<string, ProfileDelta>();
  for (const row of (priorRows ?? []) as { user_id: string | null; impact_magnitude: number | null; secondary_impact_magnitude: number | null }[]) {
    if (!row.user_id) { continue; }
    const d = deltaByUser.get(row.user_id) ?? { buildings: 0, km: 0 };
    d.buildings -= Number(row.impact_magnitude) || 0;
    d.km -= Number(row.secondary_impact_magnitude) || 0;
    deltaByUser.set(row.user_id, d);
  }
  return deltaByUser;
}

// Applies each member's net delta to their own running buildings_mapped/
// km_roads_mapped totals. Read-then-write per user rather than an atomic
// increment -- there's no RPC for it here, and mapathon credit/reversal
// isn't a high-concurrency path.
export async function applyProfileDeltas(supabase: SupabaseClient<Database>, deltaByUser: Map<string, ProfileDelta>): Promise<void> {
  for (const [userId, delta] of deltaByUser) {
    if (delta.buildings === 0 && delta.km === 0) { continue; }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('buildings_mapped, km_roads_mapped')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) { throw profileError; }
    if (!profile) { continue; }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        buildings_mapped: Math.max(0, Number(profile.buildings_mapped) + delta.buildings),
        km_roads_mapped: Math.max(0, Number(profile.km_roads_mapped) + delta.km),
      })
      .eq('id', userId);
    if (updateError) { throw updateError; }
  }
}
