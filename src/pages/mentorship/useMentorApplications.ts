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

  // "Approved" here only marks the application reviewed -- it does not
  // create a login account or a mentors row. Turning an approved
  // application into a real account is a manual step for now.
  async function setApplicationStatus(id: string, status: 'approved' | 'rejected') {
    const ok = await mutateOrToast(api.patch(`/mentor-applications/${id}`, { status }), 'Updating application');
    if (!ok) { return; }
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  const pending = applications.filter((a) => a.status === 'pending');

  return { applications, pending, loading, setApplicationStatus };
}
