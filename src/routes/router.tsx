import { createBrowserRouter } from 'react-router-dom';
import { ProtectedLayout, protectedLoader } from './ProtectedLayout';
import { LoginPage } from '../pages/login/LoginPage';
import { OverviewPage } from '../pages/overview/OverviewPage';
import { ApprovalsPage } from '../pages/approvals/ApprovalsPage';
import { ChaptersPage } from '../pages/chapters/ChaptersPage';
import { MembersPage } from '../pages/members/MembersPage';
import { ImpactPage } from '../pages/impact/ImpactPage';
import { MentorshipPage } from '../pages/mentorship/MentorshipPage';
import { ResourcesPage } from '../pages/resources/ResourcesPage';
import { PartnersPage } from '../pages/partners/PartnersPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedLayout />,
    loader: protectedLoader,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'approvals', element: <ApprovalsPage /> },
      { path: 'chapters', element: <ChaptersPage /> },
      { path: 'members', element: <MembersPage /> },
      { path: 'impact', element: <ImpactPage /> },
      { path: 'mentorship', element: <MentorshipPage /> },
      { path: 'resources', element: <ResourcesPage /> },
      { path: 'partners', element: <PartnersPage /> },
    ],
  },
]);
