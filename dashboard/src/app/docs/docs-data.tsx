import React from "react";

export interface DocArticle {
  id: string;
  slug: string;
  title: string;
  category: "CHANNELS" | "BEAMS" | "SERVER" | "DEPLOYMENT";
  section: string;
  description: string;
  tableOfContents: { id: string; title: string }[];
  content: React.ReactNode;
}

export const DOCS_SECTIONS = [
  {
    category: "CHANNELS",
    groups: [
      {
        name: "GETTING STARTED",
        subsections: [
          {
            title: "SDK quick starts",
            items: [
              { id: "javascript-quickstart", title: "JavaScript quick start" },
              { id: "android-quickstart", title: "Android quick start" },
              { id: "ios-quickstart", title: "iOS quick start" },
              { id: "flutter-quickstart", title: "Flutter quick start" },
              { id: "react-native-quickstart", title: "React Native quick start" },
            ],
          },
          {
            title: "Use case quick starts",
            items: [
              { id: "realtime-chat", title: "Javascript realtime chat" },
              { id: "realtime-user-list", title: "Javascript realtime user list" },
            ],
          },
          {
            title: "Diagnostics",
            items: [
              { id: "debugging", title: "Debugging & live logs" },
            ],
          },
        ],
      },
      {
        name: "USING CHANNELS",
        subsections: [
          {
            title: "Core concepts",
            items: [
              { id: "client-api-overview", title: "Client API overview" },
              { id: "connection", title: "Connection lifecycle" },
              { id: "public-channels", title: "Public channels" },
              { id: "private-channels", title: "Private channels & auth" },
              { id: "presence-channels", title: "Presence channels" },
              { id: "client-events", title: "Client events (peer-to-peer)" },
            ],
          },
        ],
      },
    ],
  },
  {
    category: "SERVER",
    groups: [
      {
        name: "SERVER API & SDKS",
        subsections: [
          {
            title: "Language SDKs",
            items: [
              { id: "server-overview", title: "Server API overview" },
              { id: "php-laravel", title: "PHP & Laravel broadcasting" },
              { id: "nodejs-server", title: "Node.js & TypeScript" },
              { id: "python-server", title: "Python (FastAPI, Django)" },
              { id: "go-curl-server", title: "Go & cURL triggers" },
            ],
          },
          {
            title: "Events & Webhooks",
            items: [
              { id: "webhooks-guide", title: "Webhooks & dead-letter replay" },
            ],
          },
        ],
      },
    ],
  },
  {
    category: "BEAMS",
    groups: [
      {
        name: "APS BEAMS (PUSH NOTIFICATIONS)",
        subsections: [
          {
            title: "Overview",
            items: [
              { id: "beams-overview", title: "Beams Push overview" },
              { id: "beams-android", title: "Android FCM push setup" },
              { id: "beams-ios", title: "iOS APNs push setup" },
              { id: "beams-interests", title: "Interest topics & user targeting" },
            ],
          },
        ],
      },
    ],
  },
  {
    category: "DEPLOYMENT",
    groups: [
      {
        name: "DEPLOYMENT & HOSTING",
        subsections: [
          {
            title: "Production Infrastructure",
            items: [
              { id: "cpanel-hosting", title: "cPanel Shared Hosting guide" },
              { id: "ec2-ubuntu-guide", title: "AWS EC2 & Ubuntu VPS guide" },
              { id: "docker-compose-guide", title: "Docker Compose production" },
            ],
          },
        ],
      },
    ],
  },
];
