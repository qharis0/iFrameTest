//HARIS QURESHI
//JAVASCRIPT HANDLES ALL THE INTERACTIVITY OF THE WEB APP
//THE FEATURES INCLUDED IN THIS FILE ARE:
//LOADING A LIST OF TIKTOK CONTENT IDs TO EMBED
//EMBEDDING THE VIDEOS USING TIKTOK'S API
//SCROLLS EMBEDS UP AND DOWN TO CREATE THAT FEED NAVIGATION
//RESPONDS TO BUTTONS FOR STARTING AND ENDING THE SESSION


//CREATES AN EMPTY ARRY AND THEN POPULATES IT WITH VIDEO IDs LISTED IN VIDEOS.JSON FILE.
let VIDEO_IDS = [];

async function loadVideos() {
	try {
		const response = await fetch('./videos.json');
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const data = await response.json();
		VIDEO_IDS = data.videos;
	}



// LISTENS TO INTERACTIVE ELEMENTS IN HTML DOC
const feed = document.getElementById('feed');
const quitButton = document.getElementById('exit');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');

let sessionActive = false;
let activeIndex = 0;
let ready = new Set();
let lastSwitch = 0;
let observer;

// THIS FUNCTION PAUSES AND PLAYS VIDEOS, AND IS CALLED WHEN SCROLLING THE FEED
function send(index, type) {
	const frame = document.querySelector(`iframe[data-index="${index}"]`);
	if (frame?.contentWindow) {
		frame.contentWindow.postMessage({'x-tiktok-player': true, type}, 'https://www.tiktok.com');
	}
}


// Switch the currently active video.
function showVideo(index) {
	if (!sessionActive || (index === activeIndex && lastSwitch)) {
	  return;
	}
  const previous = activeIndex;

  if (lastSwitch) {
    send(previous, 'pause');
  }

  activeIndex = index;
  lastSwitch = performance.now();

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

	sessionActive = true;
	activeIndex = 0;
	lastSwitch = 0;
	ready = new Set();


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
					entry.intersectionRatio >= .65) {
					showVideo(
						Number(entry.target.dataset.index)
					);
				}
			}
		},
		{root: feed,
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
	if (!sessionActive) {
		return;
	}
	sessionActive = false;
	send(activeIndex, 'pause');
	observer?.disconnect();
	quitButton.disabled = true;
	endOverlay.classList.remove('hidden');
}



// Listen for messages from TikTok's embedded players.
window.addEventListener('message', event => {
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

    // Playback commands disabled for debugging.
	if (sessionActive && index === activeIndex) {
		send(index, 'play');
	} else {
		send(index, 'pause');
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
