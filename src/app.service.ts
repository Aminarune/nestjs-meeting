import { Injectable } from '@nestjs/common';

const process = require('process');
const path = require('path');
const fs = require('fs').promises;

import { authenticate } from '@google-cloud/local-auth';
import { auth, OAuth2Client } from 'google-auth-library';
import { calendar_v3 } from 'googleapis';
const { SpacesServiceClient } = require('@google-apps/meet').v2;
const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar'
];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

@Injectable()
export class AppService {
  private calendar: any;
  private oauth2Client: OAuth2Client;

  constructor() {
    this.initializeGoogleAuth();
  }

  private initializeGoogleAuth() {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    // this.oauth2Client = new OAuth2Client(
    //   process.env.GOOGLE_CLIENT_ID,
    //   process.env.GOOGLE_CLIENT_SECRET,
    //   process.env.GOOGLE_REDIRECT_URI,
    // );

    // // Set credentials if you have them stored (refresh token)
    // this.oauth2Client.setCredentials({
    //   refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    // });

    const jwt = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_ID,
      key: privateKey,
      scopes: SCOPES,
    });

    this.calendar = google.calendar({ version: 'v3', auth: jwt });
  }

  async createMeetingWithCalendar(
  ) {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 1); // Set to 1 hour from now
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1); // Set to 2 hours from now
    try {
      const event: calendar_v3.Schema$Event = {
        summary: "Meeting with Google Meet",
        description: "Scheduled meeting with Google Meet",
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Asia/Bangkok',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Bangkok',
        },
        attendees: [
          //   {
          //   email: 'mifels.fem@gmail.com',
          //   displayName: 'Mifels Fem',
          //   responseStatus: 'needsAction',
          // }
        ],
        conferenceData: {
          createRequest: {
            requestId: `abc-def-ghi`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendNotifications: false,
        sendUpdates: 'none'
      });

      console.log('Meeting created:', response.data);

      const createdEvent = response.data;
      const meetLink = createdEvent.conferenceData?.entryPoints?.find(
        entry => entry.entryPointType === 'video',
      )?.uri;

      return {
        eventId: createdEvent.id,
        meetLink: meetLink || '',
        calendarLink: createdEvent.htmlLink || '',
        startTime: createdEvent.start?.dateTime,
        endTime: createdEvent.end?.dateTime,
      };
    } catch (error) {
      console.error(JSON.stringify(error.data, null, 2));
      throw new Error(`Failed to create meeting: ${error.message}`);
    }
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Method to get OAuth URL for initial setup
  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  // Method to exchange code for tokens
  async getTokenFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }
}
