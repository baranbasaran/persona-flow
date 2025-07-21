import { hubspotClient } from './hubspotClient';
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/contacts';
import { AssociationSpecAssociationCategoryEnum } from '@hubspot/api-client/lib/codegen/crm/objects';
import { SimplePublicObjectWithAssociations } from '@hubspot/api-client/lib/codegen/crm/contacts/models/SimplePublicObjectWithAssociations';

// Maximum number of retries for API calls
const MAX_RETRIES = 3;
// Base delay for exponential backoff (in ms)
const BASE_DELAY = 1000;

export interface HubSpotContact {
  id: string;
  properties: Record<string, any>;
}

export interface HubSpotError extends Error {
  response?: {
    data?: any;
    status?: number;
  };
}

/**
 * Implements exponential backoff retry logic for API calls
 * @param operation - Function to retry
 * @param retries - Number of retries remaining
 * @returns Promise of the operation result
 */
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0 && isRetryableError(error)) {
      const delay = BASE_DELAY * Math.pow(2, MAX_RETRIES - retries);
      console.log(`Retrying operation after ${delay}ms. Retries remaining: ${retries - 1}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1);
    }
    throw error;
  }
}

/**
 * Determines if an error is retryable based on its status code
 * @param error - Error from HubSpot API
 * @returns boolean indicating if the error is retryable
 */
function isRetryableError(error: any): boolean {
  const status = (error as HubSpotError).response?.status;
  // Retry on rate limits (429) and server errors (5xx)
  return status === 429 || (!!status && status >= 500 && status < 600);
}

/**
 * Fetch a contact by phone number (WhatsApp sender).
 * @param phone - Phone number to search for
 * @returns Promise resolving to contact or null if not found
 */
export async function findContactByPhone(phone: string): Promise<HubSpotContact | null> {
  try {
    return await withRetry(async () => {
      const response = await hubspotClient.crm.contacts.searchApi.doSearch({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'phone',
                operator: FilterOperatorEnum.Eq,
                value: phone,
              },
            ],
          },
        ],
        properties: ['firstname', 'lastname', 'email', 'phone', 'persona_tone', 'persona_preferences'],
        limit: 1,
      });
      const contact = response.results?.[0];
      if (!contact) return null;
      return { id: contact.id, properties: contact.properties };
    });
  } catch (error) {
    console.error('Error fetching contact by phone:', error);
    return null;
  }
}

/**
 * Update a contact by ID with new properties
 * @param contactId - HubSpot contact ID
 * @param properties - Object containing properties to update
 * @returns Promise resolving to boolean indicating success
 */
export async function updateContact(contactId: string, properties: Record<string, any>): Promise<boolean> {
  try {
    await withRetry(async () => {
      await hubspotClient.crm.contacts.basicApi.update(contactId, { properties });
    });
    return true;
  } catch (error) {
    console.error('Error updating contact:', error);
    return false;
  }
}

/**
 * Extract persona data from a HubSpot contact
 * @param contact - HubSpot contact object
 * @returns String describing the persona for prompt engineering
 */
export function extractPersonaFromContact(contact: HubSpotContact): string {
  const { firstname, lastname, persona_tone, persona_preferences } = contact.properties;
  let persona = `${firstname || ''} ${lastname || ''}`.trim();
  if (persona_tone) persona += `, tone: ${persona_tone}`;
  if (persona_preferences) persona += `, preferences: ${persona_preferences}`;
  return persona || 'default persona';
}

/**
 * Post a chat summary as a note on the contact
 * @param contactEmail - Email of the contact
 * @param summaryTitle - Title for the chat summary
 * @param summaryBody - Body content of the chat summary
 * @returns Promise resolving to boolean indicating success
 */
export async function postChatSummaryToContact(
  contactEmail: string,
  summaryTitle: string,
  summaryBody: string
): Promise<boolean> {
  try {
    return await withRetry(async () => {
      // Step 1: Find the contact by email to get their ID
      const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: FilterOperatorEnum.Eq,
                value: contactEmail,
              },
            ],
          },
        ],
        properties: ['hs_object_id'],
      });

      const contactId = searchResponse.results?.[0]?.id;
      if (!contactId) {
        console.error('Could not find HubSpot contact with email:', contactEmail);
        return false;
      }

      // Step 2: Create the note object first
      const notePayload = {
        properties: {
          hs_note_body: `${summaryTitle}\n\n${summaryBody}`,
          hs_timestamp: new Date().toISOString(),
        },
      };
      
      const noteResponse = await hubspotClient.crm.objects.notes.basicApi.create(notePayload);

      // Step 3: Create the association between the new note and the contact
      await hubspotClient.crm.associations.batchApi.create(
        'notes',
        'contacts',
        {
          inputs: [
            {
              _from: { id: noteResponse.id },
              to: { id: contactId },
              type: 'note_to_contact'
            }
          ]
        }
      );

      console.log(`Successfully associated note ${noteResponse.id} with contact ${contactId}`);
      return true;
    });
  } catch (error: any) {
    console.error('Failed to post chat summary as note to HubSpot:', error);
    if (error.body) {
      console.error('HubSpot API Error Body:', JSON.stringify(error.body, null, 2));
    }
    return false;
  }
} 