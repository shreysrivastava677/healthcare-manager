import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Call Gemini with a prompt and a 30-second timeout.
 * Returns the raw text response or null on failure.
 */
async function callGemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const result = await model.generateContent(prompt, {
      signal: controller.signal,
    });
    const response = result.response;
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract JSON from a response string that may contain markdown code fences.
 */
function extractJSON(text) {
  // Try to extract from markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }
  // Try direct parse
  return JSON.parse(text.trim());
}

/**
 * Generate a pre-visit summary from patient symptoms.
 * @param {string} symptoms - The patient's reported symptoms
 * @returns {Promise<{urgencyLevel: string, chiefComplaint: string, suggestedQuestions: string[]}|null>}
 */
export async function generatePreVisitSummary(symptoms) {
  try {
    const prompt = `You are a medical AI assistant. Analyze these patient symptoms and return ONLY a valid JSON object with: urgencyLevel (LOW/MEDIUM/HIGH), chiefComplaint (one-line summary), suggestedQuestions (array of 3 questions for the doctor to ask). Symptoms: ${symptoms}`;

    const text = await callGemini(prompt);
    if (!text) return null;

    const parsed = extractJSON(text);
    return parsed;
  } catch (error) {
    console.error('Error generating pre-visit summary:', error.message);
    return null;
  }
}

/**
 * Generate a post-visit summary from clinical notes and prescription.
 * @param {string} clinicalNotes - Doctor's clinical notes
 * @param {string} prescription - Prescription text
 * @returns {Promise<{patientFriendlySummary: string, medicationSchedule: Array, followUpSteps: string[]}|null>}
 */
export async function generatePostVisitSummary(clinicalNotes, prescription) {
  try {
    const prompt = `You are a medical AI assistant. Convert these clinical notes into a patient-friendly summary. Return ONLY a valid JSON object with: patientFriendlySummary (plain language explanation), medicationSchedule (array of {name, dosage, frequency, duration}), followUpSteps (array of action items). Clinical Notes: ${clinicalNotes} Prescription: ${prescription}`;

    const text = await callGemini(prompt);
    if (!text) return null;

    const parsed = extractJSON(text);
    return parsed;
  } catch (error) {
    console.error('Error generating post-visit summary:', error.message);
    return null;
  }
}
