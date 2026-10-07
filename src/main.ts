import './styles/main.css'
import './styles/enhancements.css'
import './styles/competition.css'
import { Experience } from './core/Experience'

async function start() {
  if ('fonts' in document) {
    await Promise.all([
      document.fonts.load('400 27px "Be Vietnam Pro"', 'Tư tưởng Hồ Chí Minh'),
      document.fonts.load('600 46px "Be Vietnam Pro"', 'Tư tưởng Hồ Chí Minh'),
      document.fonts.load('700 46px "Be Vietnam Pro"', 'Tư tưởng Hồ Chí Minh'),
      document.fonts.ready
    ])
  }
  new Experience()
}

void start()
