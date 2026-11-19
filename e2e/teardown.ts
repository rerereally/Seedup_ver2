import { testSession } from './session';

// The test makes one PRD a run; giving the use back keeps the test account under its daily limit on busy CI days.
export default async function teardown() {
  const { client } = await testSession();
  await client.rpc('release_ai_usage', { p_feature: 'prd' });
}
