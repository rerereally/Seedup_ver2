import assert from 'node:assert/strict';
import test from 'node:test';
import { PRIVACY } from '../lib/legal';

test('privacy names verification models and scopes the provider filter without promising no retention', () => {
  const section = PRIVACY.find(([title]) => title === '밖으로 보내는 곳');
  const prdLine = section?.[1].find(line => line.startsWith('- OpenRouter와 그 모델 제공사(아이디어'));
  assert.ok(prdLine);
  assert.match(prdLine, /GPT 6\.2 Sol/);
  assert.match(prdLine, /Claude Haiku 5\.5/);
  assert.match(prdLine, /최후 폴백/);

  const verification = section?.[1].find(line => line.startsWith('- OpenRouter와 그 모델 제공사(기능 검증의 코드)'));
  assert.ok(verification);
  assert.match(verification, /GPT 6\.2 Sol\(OpenAI\)/);
  assert.match(verification, /Claude Haiku 5\.5\(Anthropic\)/);
  assert.match(verification, /데이터를 수집하는 제공사를 빼는 설정/);
  assert.match(verification, /판정 결과\(인용한 코드 줄 포함\)를 저장/);
  assert.match(verification, /각자의 정책에 따라 안전 목적 등으로 입력을 일정 기간 보관할 수 있습니다/);
  assert.doesNotMatch(verification, /어디에도 저장되지 않|저장하지 않|무보관/);
});
