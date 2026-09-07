/** Shared by provider adapters and the inspector so repair wording stays auditable. */
export function userPrompt(observation: string, feedback: string | null): string {
  return feedback
    ? `${observation}\nYour previous response was rejected: ${feedback}\nRepair it against this unchanged snapshot.`
    : observation;
}
