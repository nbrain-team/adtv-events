import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import { AppLayout } from './shared/AppLayout';
import { Dashboard } from './pages/Dashboard';
// import { Campaigns } from './pages/Campaigns';
import { TemplatesFunnel } from './pages/TemplatesFunnel';
import { CampaignsLive } from './pages/CampaignsLive';
import { CampaignBuilder } from './pages/CampaignBuilder';
import { CampaignDetail } from './pages/CampaignDetail';
import { TemplateBuilder } from './pages/TemplateBuilder';
import { MediaLibrary } from './pages/MediaLibrary';
import { Calendar } from './pages/Calendar';
import { Templates } from './pages/Templates';
import { Realtors } from './pages/Realtors';
import { Leads } from './pages/Leads';
import { Settings } from './pages/Settings';
import { Inbox } from './pages/Inbox';
import { AnalyticsMaster } from './pages/AnalyticsMaster';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'templates', element: <TemplatesFunnel /> },
      { path: 'templates/:id', element: <TemplateBuilder /> },
      { path: 'campaigns', element: <CampaignsLive /> },
      { path: 'campaigns/:id', element: <CampaignBuilder /> },
      // media and calendar removed per instruction
      { path: 'inbox', element: <Inbox /> },
      { path: 'analytics', element: <AnalyticsMaster /> },
      { path: 'realtors', element: <Realtors /> },
      { path: 'leads', element: <Leads /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

