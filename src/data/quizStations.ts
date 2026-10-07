import { chapters } from './chapters'

export const quizStations = chapters.map((chapter, stage) => ({
  stage,
  label: chapter.period,
  x: chapter.board.side === 'left' ? -1.85 : 1.85,
  z: chapter.start - 1.2
}))
export const stationRadius = 2.8
