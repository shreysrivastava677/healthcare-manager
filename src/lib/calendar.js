import { google } from 'googleapis';
import prisma from '@/lib/prisma';

/**
 * Create a configured OAuth2 client.
 */
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate the Google OAuth consent URL for calendar access.
 * @param {string} userId - The user ID to pass as state
 * @returns {string} The authorization URL
 */
export function getAuthUrl(userId) {
  const oauth2Client = getOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: userId,
    prompt: 'consent',
  });
}

/**
 * Exchange an authorization code for tokens.
 * @param {string} code - The authorization code from the callback
 * @returns {Promise<{access_token: string, refresh_token: string, expiry_date: number}|null>}
 */
export async function handleCallback(code) {
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Google Calendar callback error:', error.message);
    return null;
  }
}

/**
 * Create a Google Calendar event.
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {object} eventDetails - { title, description, startTime, endTime, attendeeEmail }
 * @returns {Promise<string|null>} The event ID or null on failure
 */
export async function createCalendarEvent(
  accessToken,
  refreshToken,
  { title, description, startTime, endTime, attendeeEmail }
) {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: title,
      description,
      start: {
        dateTime: new Date(startTime).toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'email', minutes: 60 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all',
    });

    return response.data.id;
  } catch (error) {
    console.error('Create calendar event error:', error.message);
    return null;
  }
}

/**
 * Update an existing Google Calendar event.
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {string} eventId
 * @param {object} updates - Partial event updates
 * @returns {Promise<object|null>}
 */
export async function updateCalendarEvent(
  accessToken,
  refreshToken,
  eventId,
  updates
) {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const eventUpdate = {};
    if (updates.title) eventUpdate.summary = updates.title;
    if (updates.description) eventUpdate.description = updates.description;
    if (updates.startTime) {
      eventUpdate.start = {
        dateTime: new Date(updates.startTime).toISOString(),
        timeZone: 'Asia/Kolkata',
      };
    }
    if (updates.endTime) {
      eventUpdate.end = {
        dateTime: new Date(updates.endTime).toISOString(),
        timeZone: 'Asia/Kolkata',
      };
    }

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      resource: eventUpdate,
      sendUpdates: 'all',
    });

    return response.data;
  } catch (error) {
    console.error('Update calendar event error:', error.message);
    return null;
  }
}

/**
 * Delete a Google Calendar event.
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {string} eventId
 * @returns {Promise<boolean>}
 */
export async function deleteCalendarEvent(accessToken, refreshToken, eventId) {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
      sendUpdates: 'all',
    });

    return true;
  } catch (error) {
    console.error('Delete calendar event error:', error.message);
    return false;
  }
}

/**
 * Refresh an expired access token.
 * @param {string} refreshToken
 * @returns {Promise<{access_token: string, expiry_date: number}|null>}
 */
export async function refreshAccessToken(refreshToken) {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();
    return {
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
    };
  } catch (error) {
    console.error('Refresh access token error:', error.message);
    return null;
  }
}

/**
 * Get a user's stored Google Calendar tokens.
 * @param {string} userId
 * @returns {Promise<{accessToken: string, refreshToken: string}|null>}
 */
export async function getUserCalendarTokens(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiry: true,
      },
    });

    if (!user || !user.googleAccessToken || !user.googleRefreshToken) {
      return null;
    }

    // Check if token is expired and refresh if needed
    if (user.googleTokenExpiry && new Date(user.googleTokenExpiry) < new Date()) {
      const refreshed = await refreshAccessToken(user.googleRefreshToken);
      if (!refreshed) return null;

      // Update tokens in DB
      await prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: refreshed.access_token,
          googleTokenExpiry: new Date(refreshed.expiry_date),
        },
      });

      return {
        accessToken: refreshed.access_token,
        refreshToken: user.googleRefreshToken,
      };
    }

    return {
      accessToken: user.googleAccessToken,
      refreshToken: user.googleRefreshToken,
    };
  } catch (error) {
    console.error('Get user calendar tokens error:', error.message);
    return null;
  }
}
