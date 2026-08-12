import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';
import type { Mentor } from '../../types/database';

export interface MentorProfileOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

// avatar_url lives on profiles, not this table (see attachAvatars in
// api/_handlers/mentors.ts), so every /mentors response has it attached
// as an extra field rather than it being a real mentors-table column.
export type MentorWithAvatar = Mentor & { avatar_url: string | null };

interface MentorshipState {
  mentors: MentorWithAvatar[];
  sessionCount: number | null;
  loading: boolean;
}

export function useMentors() {
  const [state, setState] = useState<MentorshipState>({ mentors: [], sessionCount: null, loading: true });
  const [mentorProfiles, setMentorProfiles] = useState<MentorProfileOption[]>([]);

  const load = useCallback(async () => {
    const [mentorsResult, sessionsResult, profilesResult] = await Promise.all([
      apiOrToast(api.get<{ data: MentorWithAvatar[] }>('/mentors'), 'Loading mentors', { data: [] }),
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

  // The member-facing app looks up a mentor's name AND Calendly link
  // through profile_id (see "Connect mentors table to profiles via
  // profile_id FK") -- it reads profiles.calendly_url, not this table's
  // own `calendly_link` column, so both edits have to reach `profiles`
  // too, or admins see the change here while members keep seeing the old
  // name/link.
  async function updateMentor(mentorId: string, payload: { name: string; calendly_link: string | null }) {
    const mentor = state.mentors.find((m) => m.id === mentorId);
    if (!mentor) { return false; }

    const trimmed = payload.name.trim();
    const spaceIdx = trimmed.indexOf(' ');
    const first_name = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const last_name = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

    const [mentorOk, profileOk] = await Promise.all([
      mutateOrToast(api.patch(`/mentors/${mentorId}`, payload), 'Updating mentor'),
      mutateOrToast(api.patch(`/profiles/${mentor.profile_id}`, { first_name, last_name, calendly_url: payload.calendly_link }), 'Updating mentor profile'),
    ]);
    if (!mentorOk || !profileOk) { return false; }

    setState((prev) => ({
      ...prev,
      mentors: prev.mentors.map((m) => (m.id === mentorId ? { ...m, ...payload } : m)),
    }));
    return true;
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function uploadMentorAvatar(mentorId: string, profileId: string, file: File): Promise<string | null> {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await apiOrToast<{ url: string } | null>(
      api.post<{ url: string }>('/uploads/mentor-avatar', { profileId, dataUrl }),
      'Uploading photo',
      null
    );
    if (!result) { return null; }

    setState((prev) => ({
      ...prev,
      mentors: prev.mentors.map((m) => (m.id === mentorId ? { ...m, avatar_url: result.url } : m)),
    }));
    return result.url;
  }

  async function removeMentorAvatar(mentorId: string, profileId: string): Promise<boolean> {
    const ok = await mutateOrToast(api.patch(`/profiles/${profileId}`, { avatar_url: null }), 'Removing photo');
    if (!ok) { return false; }

    setState((prev) => ({
      ...prev,
      mentors: prev.mentors.map((m) => (m.id === mentorId ? { ...m, avatar_url: null } : m)),
    }));
    return true;
  }

  async function addMentor(profileId: string) {
    const ok = await mutateOrToast(api.post('/mentors', { profile_id: profileId, available: false }), 'Adding mentor');
    if (ok) { await load(); }
    return ok;
  }

  const unlistedMentorProfiles = mentorProfiles.filter(
    (p) => !state.mentors.some((m) => m.profile_id === p.id),
  );

  return { ...state, unlistedMentorProfiles, setMentorAvailability, updateMentor, uploadMentorAvatar, removeMentorAvatar, addMentor };
}
