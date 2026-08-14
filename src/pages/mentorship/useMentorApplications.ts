import { useCallback, useEffect, useState } from 'react';
import { api, apiOrToast, mutateOrToast } from '../../lib/apiClient';

export interface MentorApplication {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  full_name: string;
  email: string;
  date_of_birth: string | null;
  gender: string | null;
  location: string | null;
  headshot_url: string | null;
  bio: string | null;
  calendly_link: string | null;
  professional_background: string[];
  can_help_with: string[];
  comfortable_mentoring: string[];
  agreed_mentor_participation: boolean;
  agreed_general_participation: boolean;
  agreed_media_release: boolean;
  bscp_newsletter_optin: boolean | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export function useMentorApplications() {
  const [applications, setApplications] = useState<MentorApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiOrToast(
      api.get<{ data: MentorApplication[] }>('/mentor-applications'),
      'Loading mentor applications',
      { data: [] }
    );
    setApplications(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // "Approved" provisions a real account server-side (see
  // provisionMentorAccount in api/_handlers/mentorApplications.ts) and
  // creates a mentors row -- callers should reload the separate
  // useMentors() list on a successful approve, since that new row won't
  // show up there on its own.
  async function setApplicationStatus(id: string, status: 'approved' | 'rejected'): Promise<boolean> {
    const ok = await mutateOrToast(api.patch(`/mentor-applications/${id}`, { status }), 'Updating application');
    if (!ok) { return false; }
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    return true;
  }

  const pending = applications.filter((a) => a.status === 'pending');

  return { applications, pending, loading, setApplicationStatus };
}
