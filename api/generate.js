export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { topic, type, tone, duration, audience, extra } = req.body;

    const systemPrompt = `당신은 한국 방송 구성작가 출신의 영상 대본 전문가입니다.
사용자의 요청에 맞춰 즉시 촬영/편집 가능한 수준의 영상 대본을 작성합니다.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
{
  "title": "영상 제목 (클릭을 유도하는 매력적인 제목)",
  "sections": [
    {
      "timestamp": "0:00",
      "label": "구간 이름 (예: 도입-후킹)",
      "direction": "연출 지시 (카메라, 자막, 효과음 등)",
      "narration": "내레이션/대사 전문",
      "note": "편집 참고사항"
    }
  ]
}

규칙:
- 도입부는 반드시 3초 안에 시청자를 잡는 강력한 후킹으로 시작
- 각 구간에 타임코드, 연출 지시, 내레이션, 편집 노트 포함
- 대본은 구어체로 자연스럽게 (읽었을 때 자연스러운 말투)
- 시청 유지를 위한 전환점과 호기심 유발 장치 배치
- CTA(행동 유도)는 영상 중간과 마지막에 자연스럽게 삽입
- 숏폼(30초~1분)은 3~4개 구간, 롱폼(3분 이상)은 6~10개 구간으로 구성`;

    const userPrompt = `영상 대본을 작성해주세요.

주제: ${topic}
영상 유형: ${type}
톤/분위기: ${tone}
영상 길이: ${duration}
타겟 시청자: ${audience}
${extra ? '추가 요청: ' + extra : ''}

위 조건에 맞는 완성된 대본을 JSON 형식으로 작성해주세요.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'API request failed' });
    }

    const text = data.content?.map(c => c.text || '').join('') || '';

    let script;
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      script = JSON.parse(cleaned);
    } catch (e) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        script = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }
    }

    return res.status(200).json(script);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
