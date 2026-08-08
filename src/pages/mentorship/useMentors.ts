import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';
import type { Mentor } from '../../types/database';

export interface MentorProfileOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface MentorshipState {
  mentors: Mentor[];
  sessionCount: number | null;
  loading: boolean;
}

export function useMentors() {
  const [state, setState] = useState<MentorshipState>({ mentors: [], sessionCount: null, loading: true });
  const [mentorProfiles, setMentorProfiles] = useState<MentorProfileOption[]>([]);

  const load = useCallback(async () => {
    const [mentorsResult, sessionsResult, profilesResult] = await Promise.all([
      apiOrToast(api.get<{ data: Mentor[] }>('/mentors'), 'Loading mentors', { data: [] }),
      apiOrToast(api.get<{ total: number }>('/mentorship-sessions'), 'Loading session count', { total: 0 }),
      // Every mentor-role profile, so "Add Mentor" can offer the ones that
      // don't have a booking-availability row yet -- not free-typed.
      apiOrToast(api.get<{ data: MentorProfileOption[] }>('/profiles?role=mentor'), 'Loading mentor profiles', { data: [] }),
    ]);

    setState({ mentors: mentorsResult.data, sessionCount: sessionsResult.total, loading: false });
    setMentorProfiles(profilesResult.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setMentorAvailability(mentorId: string, available: boolean) {
    const ok = await mutateOrToast(api.patch(`/mentors/${mentorId}`, { available }), 'Updating mentor availability');
    if (!ok) { return; }

    setState((prev) => ({
      ...prev,
      mentors: prev.mentors.map((m) => (m.id === mentorId ? { ...m, available } : m)),
    }));
  }

  async function addMentor(profileId: string) {
    const ok = await mutateOrToast(api.post('/mentors', { profile_id: profileId, available: false }), 'Adding mentor');
    if (ok) { await load(); }
    return ok;
  }

  const unlistedMentorProfiles = mentorProfiles.filter(
    (p) => !state.mentors.some((m) => m.profile_id === p.id),
  );

  return { ...state, unlistedMentorProfiles, setMentorAvailability, addMentor };
}
