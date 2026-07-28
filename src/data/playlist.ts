import type { Track } from '../types'
import type { MixtapeResult } from '../types/mixtape'

export const DUMMY_TRACKS: Track[] = [
  {
    title: 'Midnight City',
    artist: 'M83',
    mood: 'NEON / NIGHT',
    stat: '112 BPM',
    color: 'coral',
    platforms: {
      spotify: { id: '1eyzqe2QqGZUmfcPZtrIyt', url: null },
      appleMusic: {
        id: '1674217008',
        url: 'https://music.apple.com/kr/album/midnight-city/1674216738?i=1674217008',
      },
      youtubeMusic: { id: 'dX3k_QDnzHE', url: null },
    },
  },
  {
    title: 'Plastic Love',
    artist: 'Mariya Takeuchi',
    mood: 'CITY POP',
    stat: '104 BPM',
    color: 'amber',
    platforms: {
      spotify: { id: '7rU6Iebxzlvqy5t857bKFq', url: null },
      appleMusic: {
        id: '1541673399',
        url: 'https://music.apple.com/kr/album/plastic-love/1541673202?i=1541673399',
      },
      youtubeMusic: { id: 'T_lC2O1oIew', url: null },
    },
  },
  {
    title: 'Space Song',
    artist: 'Beach House',
    mood: 'DREAMY / SOFT',
    stat: '91 BPM',
    color: 'violet',
    platforms: {
      spotify: { id: '705r2EzlkUkDoabGfJdzUe', url: null },
      appleMusic: {
        id: '1247704673',
        url: 'https://music.apple.com/kr/album/space-song/1247704667?i=1247704673',
      },
      youtubeMusic: { id: 'RBtlPT23PTM', url: null },
    },
  },
  {
    title: 'Get Lucky',
    artist: 'Daft Punk',
    mood: 'GROOVE / SUNSET',
    stat: '116 BPM',
    color: 'mint',
    platforms: {
      spotify: { id: '69kOkLUCkxIZYexIgSG8rq', url: null },
      appleMusic: {
        id: '617154366',
        url: 'https://music.apple.com/kr/album/get-lucky/617154241?i=617154366',
      },
      youtubeMusic: { id: '5NV6Rdv1a3I', url: null },
    },
  },
]

export const DUMMY_MIX = {
  title: "DOCHI'S NIGHT DRIVE",
  subtitle: 'a little neon, a little nostalgia',
  score: 'A+ / 94%',
}

export const DUMMY_MIXTAPE_RESULT: MixtapeResult = {
  tasteProfile: {
    summary: '네온빛과 밤공기처럼 부드러운 그루브를 좋아해요.',
    genres: ['city pop', 'dream pop'],
    moods: ['late night', 'warm drive'],
    traits: ['soft synths', 'nostalgic groove'],
  },
  mixtape: {
    title: DUMMY_MIX.title,
    subtitle: DUMMY_MIX.subtitle,
    dochiComment: '이 밤의 흐름, 꽤 좋네.',
    design: {
      atmosphere: '작은 네온사인이 켜진 밤의 드라이브',
      palette: ['midnight blue', 'coral', 'amber'],
      texture: 'matte cassette plastic',
      motifs: ['city lights', 'tiny stars'],
    },
    tracks: DUMMY_TRACKS.map((track, index) => ({
      id: `recommendation-${String(index + 1).padStart(3, '0')}`,
      title: track.title,
      artist: track.artist,
      album: '',
      reason: '도치가 준비한 개발용 추천곡이에요.',
      catalogStatus: 'verified' as const,
      platforms: track.platforms,
    })),
  },
}
