let VIDEO_IDS = [];



async function loadVideos() {
  try {
    const response = await fetch('./videos.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.videos)) {
      throw new Error('videos.json must contain a videos array');
    }

    VIDEO_IDS = data.videos.filter(id =>
      /^\d{15,25}$/.test(String(id))
    ).map(String);

    console.log(`Loaded ${VIDEO_IDS.length} videos`);

  } catch (error) {
    console.error('Failed to load videos:', error);
    alert('Could not load videos.json. Check the Console.');
  }
}



// Page elements
const feed = document.getElementById('feed');
const position = document.getElementById('position');
const quitButton = document.getElementById('exit');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');

// Session state
const events = [];

let startedAt = null;
let endedAt = null;
let activeIndex = 0;
let ready = new Set();
let lastSwitch = 0;
let observer;


// Record an event in the session log.
function log(type, extra = {}) {
  events.push({
    type,
    at: new Date().toISOString(),
    elapsedMs: startedAt
      ? Math.round(performance.now() - startedAt.mono)
      : 0,
    ...extra
  });
}


// Send a playback command to a TikTok embed.
function send(index, type) {
  const frame = document.querySelector(
    `iframe[data-index="${index}"]`
  );

  if (frame?.contentWindow) {
    frame.contentWindow.postMessage(
      {
        'x-tiktok-player': true,
        type
      },
      'https://www.tiktok.com'
    );
  }
}


// Switch the currently active video.
function showVideo(index) {
  if (
    !startedAt ||
    endedAt ||
    (index === activeIndex && lastSwitch)
  ) {
    return;
  }

  const previous = activeIndex;

  if (lastSwitch) {
    send(previous, 'pause');
  }

  activeIndex = index;
  lastSwitch = performance.now();

  position.textContent =
    `Video ${index + 1} of ${VIDEO_IDS.length}`;

  log('video_changed', {
    from: previous,
    to: index,
    videoId: VIDEO_IDS[index]
  });

  if (ready.has(index)) {
    send(index, 'play');
  }
}


// Create the scrolling feed from the video IDs.
function buildFeed() {
  feed.replaceChildren();

  VIDEO_IDS.forEach((id, index) => {
    // Skip invalid video IDs.
    if (!/^\d{15,25}$/.test(id)) {
      return;
    }

    const slide = document.createElement('section');
    slide.className = 'slide';
    slide.dataset.index = index;

    const wrap = document.createElement('div');
    wrap.className = 'player';

    const frame = document.createElement('iframe');
    frame.dataset.index = index;
    frame.title = `Curated TikTok video ${index + 1}`;
    frame.allow = 'autoplay; fullscreen; encrypted-media';


    frame.src =
	`https://www.tiktok.com/player/v1/${id}` +
	`?autoplay=1&muted=1&loop=1&rel=0&controls=1`;

    wrap.append(frame);
    slide.append(wrap);
    feed.append(slide);
  });
}


// Start a new viewing session.
async function showfeed() {
  await loadVideos();
  if (!VIDEO_IDS.length) {
    return alert(
      'Add at least one TikTok video ID to app.js.'
    );
  }

  buildFeed();

  startedAt = {
    iso: new Date().toISOString(),
    mono: performance.now()
  };

  endedAt = null;
  activeIndex = 0;
  lastSwitch = 0;
  ready = new Set();

  events.length = 0;

  log('session_started');

  position.textContent =
    `Video 1 of ${VIDEO_IDS.length}`;

  startOverlay.classList.add('hidden');
  endOverlay.classList.add('hidden');

  quitButton.disabled = false;

  observer?.disconnect();

  // Detect which slide is visible.
  observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= .65
        ) {
          showVideo(
            Number(entry.target.dataset.index)
          );
        }
      }
    },
    {
      root: feed,
      threshold: [.65]
    }
  );

  document.querySelectorAll('.slide').forEach(
    el => observer.observe(el)
  );

  showVideo(0);
}


// End the viewing session.
function showexitpanel() {
  if (!startedAt || endedAt) {
    return;
  }

  send(activeIndex, 'pause');

  endedAt = {
    iso: new Date().toISOString(),
    elapsedMs: Math.round(
      performance.now() - startedAt.mono
    )
  };

  log('session_ended');

  observer?.disconnect();
  quitButton.disabled = true;

  endOverlay.classList.remove('hidden');
}



// Listen for messages from TikTok's embedded players.
window.addEventListener('message', event => {
	if (event.origin === 'https://www.tiktok.com') {
		console.log('TikTok message received:', event.data);
	}
  if (
    event.origin !== 'https://www.tiktok.com' ||
    !event.data ||
    event.data['x-tiktok-player'] !== true
  ) {
    return;
  }

  const frames = [
    ...document.querySelectorAll('iframe')
  ];

  const index = frames.findIndex(
    f => f.contentWindow === event.source
  );

  if (index < 0) {
    return;
  }

  if (event.data.type === 'onPlayerReady') {
    ready.add(index);

    log('player_ready', { index });

    // Playback commands disabled for debugging.
if (
  startedAt &&
  !endedAt &&
  index === activeIndex
) {
  send(index, 'play');
} else {
  send(index, 'pause');
}
  }

	if (event.data.type === 'onPlayerError') {
	console.error(
		'TikTok player error:',
		'Video index:', index,
		'Error details:', event.data.value
	);

	log('player_error', {
		index,
		error: event.data.value
	});
	}

  if (
    event.data.type === 'onStateChange' &&
    event.data.value === 1 &&
    index !== activeIndex
  ) {
    send(index, 'pause');
  }
});


// Connect the interface buttons.
document.getElementById('start')
  .addEventListener('click', showfeed);

document.getElementById('exit')
  .addEventListener('click', showexitpanel);
