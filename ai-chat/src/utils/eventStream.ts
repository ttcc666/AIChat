const DOUBLE_LINE_BREAK_PATTERN = /\r?\n\r?\n/

export async function consumeEventStream(
  response: Response,
  onData: (data: string) => boolean | void | Promise<boolean | void>,
): Promise<void> {
  if (!response.body) {
    throw new Error('Readable stream not supported in this environment')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })

      let match = buffer.match(DOUBLE_LINE_BREAK_PATTERN)
      while (match) {
        const index = match.index ?? -1
        if (index === -1) {
          break
        }
        const rawEvent = buffer.slice(0, index)
        buffer = buffer.slice(index + match[0].length)
        await handleEvent(rawEvent, onData)
        match = buffer.match(DOUBLE_LINE_BREAK_PATTERN)
      }
    }

    buffer += decoder.decode()
    if (buffer.trim().length > 0) {
      await handleEvent(buffer, onData)
    }
  } catch (error) {
    if (error instanceof StopStreamSignal) {
      return
    }
    throw error
  }
}

async function handleEvent(
  rawEvent: string,
  onData: (data: string) => boolean | void | Promise<boolean | void>,
): Promise<void> {
  const trimmedEvent = rawEvent.trim()
  if (!trimmedEvent) {
    return
  }

  const lines = trimmedEvent.split(/\r?\n/).map((line) => line.trim())
  const dataLines = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim())

  if (dataLines.length > 0) {
    for (const payload of dataLines) {
      if (!payload) {
        continue
      }
      const result = await onData(payload)
      if (result === false) {
        throw new StopStreamSignal()
      }
    }
    return
  }

  for (const line of lines) {
    if (!line || line.startsWith('event:') || line.startsWith('id:') || line.startsWith(':')) {
      continue
    }
    const result = await onData(line)
    if (result === false) {
      throw new StopStreamSignal()
    }
  }
}

class StopStreamSignal extends Error {}
