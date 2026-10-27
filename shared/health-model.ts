// Query preparation only. These terms are candidates, never executable health rules.
export interface HealthQueryPlan {
  diseases: { input: string; canonical: string | null }[];
  evidenceQueries: string[];
}
export interface HealthPreparation {
  state: 'evidence_required';
  message: string;
  plan: HealthQueryPlan;
}
