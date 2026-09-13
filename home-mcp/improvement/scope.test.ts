import { conversationIsSupportedLights, normalizeImprovementConversation } from './scope'

describe('conversation improvement privacy and scope', () => {
  it('sanitizes before persistence and ignores client light flags on unrelated turns', () => {
    const conversation = normalizeImprovementConversation({
      version: 1,
      threadId: 'thread-one',
      userScope: 'stable-user',
      createdAt: 1,
      updatedAt: 3,
      turns: [{
        id: 'turn-one',
        createdAt: 1,
        userText: 'Are the Living Room lights on?',
        assistantText: 'They are off.',
        outcome: 'answer',
        parsedAsLights: true,
        handledByHomeMcp: true,
        contextBefore: null,
        contextAfter: {
          domain: 'lights',
          roomId: 'living-room',
          entityIds: ['light.living_room_front_left_light'],
          lightNames: ['Front Left'],
          lastAction: 'state',
        },
      }, {
        id: 'turn-two',
        createdAt: 2,
        userText: 'My password=CorrectHorseBatteryStaple123 and sensor.private_state should stay private.',
        assistantText: 'I can help.',
        outcome: 'answer',
        parsedAsLights: true,
        handledByHomeMcp: false,
        contextBefore: {
          domain: 'lights',
          roomId: 'living-room',
          entityIds: ['light.living_room_front_left_light'],
          lightNames: ['Front Left'],
          lastAction: 'state',
        },
        contextAfter: {
          domain: 'lights',
          roomId: 'living-room',
          entityIds: ['light.living_room_front_left_light'],
          lightNames: ['Front Left'],
          lastAction: 'state',
        },
      }],
    }, 'stable-user')

    expect(conversation).not.toBeNull()
    expect(conversation!.turns[0].contextAfter?.entityIds).toEqual([])
    expect(conversation!.turns[1].userText).not.toContain('CorrectHorseBatteryStaple123')
    expect(conversation!.turns[1].userText).not.toContain('sensor.private_state')
    expect(conversation!.turns[1].parsedAsLights).toBe(false)
    expect(conversation!.turns[0].handledByHomeMcp).toBe(true)
    expect(conversation!.turns[1].handledByHomeMcp).toBe(false)
    expect(conversationIsSupportedLights(conversation!)).toBe(false)
  })

  it('drops unconfigured or private context fields before persistence', () => {
    const conversation = normalizeImprovementConversation({
      version: 1,
      threadId: 'thread-invalid-context',
      userScope: 'stable-user',
      createdAt: 1,
      updatedAt: 2,
      turns: [{
        id: 'turn-invalid-context',
        createdAt: 2,
        userText: 'Turn it off.',
        assistantText: 'Which room?',
        outcome: 'answer',
        parsedAsLights: true,
        handledByHomeMcp: false,
        contextBefore: {
          domain: 'lights',
          roomId: 'living-room',
          entityIds: ['switch.garage_door'],
          lightNames: ['password=SecretValue123456789'],
          historyBefore: 'private medical appointment',
        },
        contextAfter: null,
      }],
    }, 'stable-user')

    expect(conversation?.turns[0].contextBefore).toBeNull()
    expect(JSON.stringify(conversation)).not.toContain('SecretValue123456789')
    expect(JSON.stringify(conversation)).not.toContain('private medical appointment')
  })

  it('redacts credentials expressed as natural language', () => {
    const conversation = normalizeImprovementConversation({
      version: 1,
      threadId: 'thread-password',
      userScope: 'stable-user',
      createdAt: 1,
      updatedAt: 2,
      turns: [{
        id: 'turn-password',
        createdAt: 2,
        userText: 'Turn on the Living Room lights; the Wi-Fi password for guests is correct horse battery staple and account 12345678901234567890.',
        assistantText: 'I turned on the lights.',
        outcome: 'answer',
        parsedAsLights: true,
        contextBefore: null,
        contextAfter: { domain: 'lights', roomId: 'living-room', entityIds: [], lightNames: [], lastAction: 'on' },
      }],
    }, 'stable-user')

    expect(conversation?.turns[0].userText).not.toContain('correct horse battery staple')
    expect(conversation?.turns[0].userText).not.toContain('12345678901234567890')
    expect(conversation?.turns[0].userText).toContain('[redacted]')
  })

  it('redacts common private numeric formats', () => {
    const conversation = normalizeImprovementConversation({
      version: 1,
      threadId: 'thread-numbers',
      userScope: 'stable-user',
      createdAt: 1,
      updatedAt: 2,
      turns: [{
        id: 'turn-numbers',
        createdAt: 2,
        userText: 'Turn on the Kitchen lights. Call (555) 123-4567 about 123-45-6789 and account 12345678901234567890.',
        assistantText: 'I turned on the lights.',
        outcome: 'answer',
        parsedAsLights: true,
        contextBefore: null,
        contextAfter: { domain: 'lights', roomId: 'kitchen', entityIds: [], lightNames: [], lastAction: 'on' },
      }],
    }, 'stable-user')

    expect(conversation?.turns[0].userText).not.toContain('(555) 123-4567')
    expect(conversation?.turns[0].userText).not.toContain('123-45-6789')
    expect(conversation?.turns[0].userText).not.toContain('12345678901234567890')
  })

  it('redacts email addresses and street addresses before entity matching', () => {
    const conversation = normalizeImprovementConversation({
      version: 1,
      threadId: 'thread-address',
      userScope: 'stable-user',
      createdAt: 1,
      updatedAt: 2,
      turns: [{
        id: 'turn-address',
        createdAt: 2,
        userText: 'Turn on the Kitchen lights and email alice@example.com at 123 Main Street.',
        assistantText: 'I turned on the lights.',
        outcome: 'answer',
        parsedAsLights: true,
        contextBefore: null,
        contextAfter: { domain: 'lights', roomId: 'kitchen', entityIds: [], lightNames: [], lastAction: 'on' },
      }],
    }, 'stable-user')

    expect(conversation?.turns[0].userText).not.toContain('alice')
    expect(conversation?.turns[0].userText).not.toContain('123 Main Street')
  })

  it('redacts network names and short access codes', () => {
    const conversation = normalizeImprovementConversation({
      version: 1,
      threadId: 'thread-network',
      userScope: 'stable-user',
      createdAt: 1,
      updatedAt: 2,
      turns: [{
        id: 'turn-network',
        createdAt: 2,
        userText: 'Turn on the Kitchen lights; my wireless network is Home.Net and use PIN #1234 plus pass code 5678.',
        assistantText: 'I turned on the lights.',
        outcome: 'answer',
        parsedAsLights: true,
        contextBefore: null,
        contextAfter: { domain: 'lights', roomId: 'kitchen', entityIds: [], lightNames: [], lastAction: 'on' },
      }],
    }, 'stable-user')

    expect(conversation?.turns[0].userText).not.toContain('Home.Net')
    expect(conversation?.turns[0].userText).not.toContain('1234')
    expect(conversation?.turns[0].userText).not.toContain('5678')
  })
})
