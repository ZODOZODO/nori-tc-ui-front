const MODEL_VERSION_TIME_ZONE = 'Asia/Seoul'
const MODEL_VERSION_SEQUENCE_DIGITS = 4

interface ModelVersionLike {
  modelName: string
  modelVersion: string
}

const formatModelVersionDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MODEL_VERSION_TIME_ZONE,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value ?? '00'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'

  return `${year}.${month}.${day}`
}

const extractDailySequence = (modelVersion: string, versionPrefix: string): number => {
  if (!modelVersion.startsWith(versionPrefix)) {
    return -1
  }

  const sequenceText = modelVersion.slice(versionPrefix.length)
  if (
    sequenceText.length !== MODEL_VERSION_SEQUENCE_DIGITS ||
    !/^\d+$/.test(sequenceText)
  ) {
    return -1
  }

  return Number(sequenceText)
}

export const createNextDailyModelVersion = (
  modelName: string,
  modelVersions: readonly ModelVersionLike[],
  date: Date = new Date(),
): string => {
  const versionPrefix = `${formatModelVersionDate(date)}.`
  const maxSequence = modelVersions.reduce((currentMaxSequence, model) => {
    if (model.modelName !== modelName) {
      return currentMaxSequence
    }

    return Math.max(
      currentMaxSequence,
      extractDailySequence(model.modelVersion, versionPrefix),
    )
  }, -1)

  return `${versionPrefix}${String(maxSequence + 1).padStart(
    MODEL_VERSION_SEQUENCE_DIGITS,
    '0',
  )}`
}
