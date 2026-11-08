# Process narrative: evidence for finishing PROCESS.md

Not a draft. PROCESS.md, README.md, the reflections and the decision records
are Brynly's to write (CLAUDE.md, "Every change"). This is facts, quotes and
commits to write them from. Quotes are Brynly's messages as typed, from
`notes/decisions-log.md` unless another source is named. Every commit linked
here resolves in this repo (`git cat-file -e`). The two rethink commits,
[`fd005d2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fd005d2) and [`aa5eebf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/aa5eebf), are not on `main`. They are reachable through the tag
[`rethink-trial`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/tree/rethink-trial),
which is pushed.

## 1. The framing (Brynly, 8 November 2026)

> make a note for finishing out the process on how i've been fleshing out facets of the site in all areas of human computer interaction and how attention has been drawn to different areas of it and refined throughout, this is the main narrative of the process, as the site has evolved based on deepening insights of useability and utility and experience, with features and purpose dynamically responding to these, another angle for the process is trial of options, i.e. the rethink, which whilst not directly helpful serve to breakthrough into deeper insight which drives more informed decision making

Tags: `crit-9` is [`eeeb3cf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/eeeb3cf) (14 Oct). `crit-10` is [`6e5671b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6e5671b) (21 Oct).
`before-rethink` is [`d627070`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d627070) (8 Nov). `rethink-trial` is [`aa5eebf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/aa5eebf); its
parent is [`fd005d2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fd005d2), whose parent is [`d627070`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d627070).

## 2. Where attention went, in order

Each line gives the date, where attention went, Brynly's direction and the commits.

- **6 to 7 Oct: AIR.** A market in shares of nothing on a bonding curve, with a bubble that pops after five minutes without a buy, checks in `spec/`, and a first README. [`c597051`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c597051) [`e7bf035`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e7bf035) [`f9835e1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f9835e1) [`16bf213`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/16bf213)
- **13 Oct, 10:25: the pivot, from a market to speech and how it was said.** Brynly asked whether any speech-to-text could transcribe inflection, then pivoted the day before crit 9. Claude had raised a risk ("a chat room with the nouns swapped"). [`9f2f44b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9f2f44b). By 10:36 the first loop worked: record, Whisper in the browser, measure each word, draw it. [`37b6cfe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/37b6cfe) [`46d4caf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/46d4caf)
- **13 Oct, 10:48: expression inside the text.** Drawn-out words became repeated letters ("sooo") in place of letter-spacing. This was Brynly's idea. [`a26d888`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a26d888)
- **13 Oct, 11:09 to 12:13: hearing accuracy on real audio.** "Do more testing on real audio". Tested on JFK, MLK, a TED talk, 178 CREMA-D takes, babble and echo, EARS whispers, and split words. [`5681030`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5681030) [`1265b84`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1265b84) [`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073) [`dca3a7a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/dca3a7a) [`c357e2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c357e2a) [`0cbcdf4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0cbcdf4)
- **13 Oct, 11:11 to 11:50: phones, load, liveness, basic accessibility** (built by Claude). [`610f349`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/610f349) [`c431a2e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c431a2e) [`2a43e97`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a43e97) [`32cdec4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/32cdec4) [`2b24ed7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2b24ed7)
- **13 Oct, 11:49: making emotion inferable.** "i think id rather the emotion be inferrable" (quoted in CLAUDE.md, [`df22520`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/df22520)). This came after Claude raised the CHI 2023 finding. Brynly kept playback at the pace it was said and trialled a usual voice and a pitch line. [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)
- **13 Oct, 15:52: the live-stage redesign** (Brynly's spec, one message). Phrases send themselves, the microphone is a toggle with no limit, places are scattered in their own colours, words appear one at a time, and the last lingers. No log, borders, grid or rotation. "get rid of the pitch lines i dont like that" (as quoted in CLAUDE.md). [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c). Followed by [`01641cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/01641cc) [`ae57f14`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ae57f14) [`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d)
- **13 Oct, 23:14: the word queue** (Brynly's idea). Then "1 s at a time", then "make the queue go in real time". [`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566) [`e9e6e80`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e9e6e80)
- **14 Oct: crit 9.** [`eeeb3cf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/eeeb3cf)
- **14 Oct: legibility, and emotion from the face.** "reintroduce a brief record of whats been said for legibility, look into emotion capturing (emojis) via facial recognition". [`5d099dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d099dd) [`200bce1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/200bce1) [`d6c7ba6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d6c7ba6) [`9b71d46`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9b71d46). Logging for narrating crit 10 from `flyctl logs`: [`e0386ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e0386ef). Hints for a newcomer: [`34e2e94`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/34e2e94)
- **20 Oct, 12:17 to 12:34: look and layout, modelled on texting.** "the design is ugly i dont like the background colour, also lets try to model texting a little bit, i want you're own texts to sit on the left and everyone elses to be stacked on the right ... text appears when nothing is spoken (thankyou appears alot) ... the whole design needs a feacelift". [`dd82631`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/dd82631) [`b34ab75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b34ab75)
- **20 Oct, 13:01 to 13:20: avatars instead of an emoji.** "i dont want it to just show face i want there to be emojis/avatars mimicking your facial expressions, and for them to be customiseable". "it started bugging out" led to finding the Whisper loop. [`32e17b4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/32e17b4) [`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c)
- **20 Oct, 14:59: live, not buffered; history like texts.** "get rid of the loading zone and have the text be transmitted directly, with options to modify text be done live without a buffer". The queue was removed. [`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)
- **20 Oct, 16:09 to 17:23: layout and delay, then 3D.** "i want the text bubble column to go top down, and for the bottom of the scroll view to fade out ... i don't want the user box height to be dynamic ... is there a way to have less delay ... we need to think big ... lets do 3d heads". [`13a4e40`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/13a4e40) [`42c293b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/42c293b) [`90dd4fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/90dd4fe)
- **20 Oct, 20:07: how responsive the avatar is.** "i need the head to be more respsonive work and iterate on everything". [`70b2085`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/70b2085)
- **20 Oct, 22:26: noise and face-finding, from Brynly's own live test.** "its picking up noise and not able to find my face". [`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481)
- **20 to 21 Oct: expressiveness and extensibility.** "i want to go really deep on the extensibility and customiseability too and really maximise expressiveness". Brynly chose all four directions offered and asked for them to be built overnight. [`c04f4e4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c04f4e4) [`6590dbd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6590dbd) [`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe) [`4940473`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/4940473)
- **21 Oct: crit 10.** [`6e5671b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6e5671b)
- **22 Oct: the big tickets.** "... i think customising should be its whole own screen, look into whole body avatars, with hand gesture recognition, following that lets look at making the space more like a real space, even 3d with what feels like a real room with avatars in it, also i want to look at text to speech ..." (full quote in the log). Then "ok get to work". The studio: [`d6827db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d6827db). Three spikes measured before building: [`2e0f372`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2e0f372)
- **28 Oct: body and hands, turn-taking, the 3D room, hearing others in a voice.** [`81d2090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/81d2090) [`d4bff2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d4bff2a) [`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650) [`60cdd2f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/60cdd2f) [`859b13f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/859b13f) [`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255) [`19cf280`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/19cf280). Two reviews, fixed: [`357a6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/357a6b0) [`3408741`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/3408741)
- **2 to 3 Nov: glitches, found in headless sessions of two to seven people at desktop and phone sizes.** "things are a bit glitchy i want you to work and refine them", then "ok lets get to it". [`24b4056`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/24b4056) [`5c28ef9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5c28ef9) [`5cff87b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5cff87b) [`94e7640`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/94e7640) [`77035aa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/77035aa) [`caa187a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/caa187a) [`eeb636c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/eeb636c) [`75dd8a7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/75dd8a7) [`d0a55de`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d0a55de) [`b3c2ef9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b3c2ef9) [`d742832`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d742832) [`642c7be`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/642c7be) [`174f4cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/174f4cc) [`d2d4cc1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d2d4cc1) [`b3c649b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b3c649b) [`8241d70`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8241d70) [`043f36c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/043f36c) [`b5a03aa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b5a03aa) [`4bcaad3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/4bcaad3) [`123a049`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/123a049) [`305396c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/305396c)
- **3 Nov: typing as another way to speak.** "can we do text to speech option as well with customiseability there". [`850616c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/850616c)
- **4 Nov: voice quality and choice.** "ok i want voice quality to be improved and more selectable for different voices", then "work hard and long on improving this". [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f) [`e281037`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e281037) [`82bb3ad`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/82bb3ad) [`58f7ec1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/58f7ec1) [`78963db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/78963db) [`a76ed3a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a76ed3a) [`ba73bff`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ba73bff) [`10504a4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/10504a4) [`0ecf7c4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0ecf7c4)
- **4 Nov: background noise, asked about a second time.** "fix what you mentioned about picking up background noise". [`e372665`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e372665) [`f50b82b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f50b82b)
- **4 to 5 Nov: the room's look, its smoothness, and control of the view.** "completely level up the quality of the graphics and the smoothness, ( want control over the view of the room as well)". [`759d0e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/759d0e3) [`a86ead9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a86ead9) [`efaf24c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/efaf24c) [`c18b751`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c18b751) [`50a9cfb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/50a9cfb) [`7f02c7d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7f02c7d) [`c4bc696`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c4bc696) [`0c6b622`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0c6b622) [`e13283f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e13283f) [`e954e9b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e954e9b) [`e2757f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e2757f5) [`fdab177`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fdab177) [`3b4f7db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/3b4f7db) [`9745fa7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9745fa7) [`505540e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/505540e) [`4c07961`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/4c07961)
- **5 Nov: polish for the rest of the page.** Same request. CLAUDE.md also quotes, dated 4 Nov: "considerably more polished stylish and slick, with seamless and stunning design" (that quote first appears in [`df22520`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/df22520)). [`c211045`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c211045) [`84d0d7f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/84d0d7f) [`8cf510d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8cf510d) [`b0bf480`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b0bf480) [`409d5fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/409d5fe) [`713d712`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/713d712) [`eebcf44`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/eebcf44) [`24d5a36`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/24d5a36) [`91e966e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/91e966e) [`1ce0366`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1ce0366) [`affe7b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/affe7b5)
- **7 Nov: the rules written down.** CLAUDE.md inferred from Brynly's directions, at Brynly's request. [`df22520`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/df22520)
- **7 Nov: being in the room, by walking and full screen.** "can we make it so that you can control your avatar and move around, also i want a full screen option for that". Claude had offered three other ideas: a guessing game, room captions, cutting back. [`0023cd6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0023cd6)
- **8 Nov, 13:46: walking reimagined.** "ok theres a lot more work that needs to be done on that", then "reimagine the whole thing". [`990b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/990b708)
- **8 Nov, 15:36 to 16:34: rooms, how a room looks, a cohesive UI.** "things are still bugging and i want customisability / options for selection for the room, along with options to have different rooms / spaces, featuring different groups etc and i want the ui to feel more cohesive and intuitive". [`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9) [`18896f9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/18896f9) [`6c79269`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6c79269) [`b74e452`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b74e452) [`0478f98`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0478f98)
- **8 Nov, 17:38 to 17:42: purpose, by trial.** "it sucks, the room customiseability needs a lot more work, more over the whole site feels a bit goofy and purposeless we need to completely big picture the site and think about how it can be slick, streamlined and useful (and not clunky) if this might entail some radical change then thats ok". A captions-only version was built ([`fd005d2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fd005d2) [`aa5eebf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/aa5eebf)) and not merged. Brynly's response: "no i still want the avatars".
- **8 Nov, 20:02: purpose chosen; Space; lenses.** "i feel like i just need a good purpose for the site, what s a good use for being able to walk around as an avatar with live captions", then "ok lets go with the first", which was a party you can read. Space: "and lets also trial, in a seperate window, texting your text is your avatar that you move around a space (no need for decorations or so forth) its like you are the text and you can move that toward or away from others". Lenses: "im looking for creative ways to communicate is really the core idea of this website, so any further ideas are also welcome (iimplemented alongside whats already there so far) maybe with communication through non text mediums where speech / text is mapped directly to emojis or colors or some other more nuanced / abstract kind of expression". [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)
- **8 Nov, 20:46: typing word by word, lenses over heads, ripples and tones.** "text should send on hitting space bar". [`197afe3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/197afe3)

## 3. Facets of HCI, with evidence

A fact can appear under more than one facet.

### Usability (controls, layout, one place for each thing, phone)

- A talk button with a preview and a send step ([`37b6cfe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/37b6cfe)) became a microphone toggle with no time limit, with phrases that send themselves. [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)
- The layout went through several steps:
  - places scattered over a stage [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)
  - texting: you on the left, others stacked on the right, three columns, stacked on a phone [`b34ab75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b34ab75)
  - your card on the left and the queue as a bar along the bottom [`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c)
  - fixed-height cards with a top-down thread [`13a4e40`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/13a4e40)
  - one or two others take the whole width [`94e7640`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/94e7640)
  - panels, and even grids on a phone [`713d712`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/713d712)
  - one column: your card, one panel for saying something, then tabs [`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9)
- Customising got a screen of its own. Brynly, 22 Oct: "a whole preview option (currently you have to scroll back up to the top to see your avatar) i think customising should be its whole own screen". [`d6827db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d6827db). On a phone, the studio's choices had started below the fold. [`d0a55de`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d0a55de)
- The room takes the wide side when you're in it. [`60cdd2f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/60cdd2f). On a phone the room comes first, your controls are under it, and your own card isn't shown. [`9745fa7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9745fa7)
- Control over the view: four views; drag, scroll, pinch or keys; Reset or a double click; the camera stays inside the room. [`759d0e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/759d0e3). A flicked camera glides to a stop and turns back at once. [`a86ead9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a86ead9)
- Walking: W A S D, a tap on the floor, or a stick. [`0023cd6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0023cd6). A tap finds a way round, W A S D slide along what they meet, and a tap near your chair sits you down. [`990b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/990b708)
- Keys pressed in the room stay the room's: W A S D work after a view is clicked [`18896f9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/18896f9). Walking had typed over your last word, and Enter sent it. Focus returns after Reset. [`b74e452`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b74e452)
- The hand button changes the moment it's pressed, and quick presses don't undo themselves. [`77035aa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/77035aa)
- ← and → choose your own words without a pointer. [`043f36c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/043f36c)
- No sideways scroll at 390 px wide: the tones row had made the page 682 px wide. [`1ce0366`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1ce0366). A long word or long name now stays inside its card. [`642c7be`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/642c7be). The typing hint fits a phone. [`affe7b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/affe7b5)
- On a phone, the Rooms link goes when the room switcher is there. [`197afe3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/197afe3)

### Utility and purpose

- AIR worked, with checks in `spec/`, and was dropped for inflection. [`c597051`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c597051) [`e7bf035`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e7bf035) [`9f2f44b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9f2f44b)
- Emotion is to be inferred, not labelled. [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e). The face first went out as one of six emoji [`200bce1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/200bce1). Avatars then copy the face without naming an emotion [`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c). Emotes let people label on purpose. [`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe)
- A record came back "for legibility", so someone arriving can catch up. [`5d099dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d099dd)
- Typing as another way in, with a tone. [`850616c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/850616c)
- Turn-taking: a raised-hand queue, the same on every page. [`d4bff2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d4bff2a)
- Rooms for different groups. [`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9)
- "goofy and purposeless" led to the captions-only trial. Its log names expressive captions for deaf and hard-of-hearing readers as the use. [`fd005d2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fd005d2) [`aa5eebf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/aa5eebf)
- "no i still want the avatars" led to a party you can read: several conversations at once, and you follow the one you walk up to. [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)
- "creative ways to communicate is really the core idea of this website" led to words, colour and emoji lenses, ripples and Tones. [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277) [`197afe3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/197afe3)
- Open (log gap): the README's "What good means" still describes the site before the party and Space.

### Experience, aesthetics and polish

- "the design is ugly ... feacelift" led to a deep blue-charcoal palette, colour only on people, and a light theme from the same tokens. [`b34ab75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b34ab75)
- Faces: 3D heads [`90dd4fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/90dd4fe), later lit the way the room is lit. [`84d0d7f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/84d0d7f)
- The room repainted in code: canvases, furniture, light from all round, and Neutral tone mapping. [`759d0e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/759d0e3)
- Details added to the room:
  - sun shafts with dust [`efaf24c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/efaf24c)
  - fairy lights [`c18b751`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c18b751)
  - a light on whoever's talking [`50a9cfb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/50a9cfb)
  - shadows under things on the table [`7f02c7d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7f02c7d)
  - a dusk scene while the room loads [`c4bc696`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c4bc696)
  - shading where things meet [`e2757f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e2757f5)
  - depth of field in the speaker view [`fdab177`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fdab177)
- Motion eases rather than jumps:
  - the camera moves on springs [`e954e9b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e954e9b)
  - seats glide, and someone new rises into their seat [`3b4f7db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/3b4f7db)
  - words over heads spring up [`e13283f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e13283f)
  - arms swing as you walk [`990b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/990b708)
- The page: Inter with Bricolage Grotesque, cards tinted by person and breathing while they speak, and a headline drawn the way speech is. [`c211045`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c211045). The studio [`8cf510d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8cf510d) [`b0bf480`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b0bf480). Help, About and Lately. [`409d5fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/409d5fe)
- Smoothness measured rather than guessed: 60 fps with 12 people at 1440x900, and 51 fps for 8 people at phone size with the CPU slowed 4x. [`759d0e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/759d0e3). A slow screen gives up effects first. [`759d0e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/759d0e3) [`e2757f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e2757f5)
- Words fade with distance, and further off only a murmur shows. [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)

### Feedback and liveness

- Words reach every other page within a second, without a reload. [`9f2f44b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9f2f44b)
- A "Live" or "Reconnecting…" line by the heading. [`32cdec4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/32cdec4)
- Playback at the pace a phrase was said. [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e). Each word stays up at least 0.25 s, and the page says how many phrases it's catching up on. [`01641cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/01641cc)
- Errors stay up for 6 s, and the page says when the microphone stops by itself. [`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d)
- With the queue gone, a phrase reaches the server 1.2 s after it's finished. [`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)
- Drafts while someone is still talking: "And so" shows 1.8 s after they start (it was 3.4 s). [`42c293b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/42c293b). Drafts settle in place [`5c28ef9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5c28ef9), and the big word shows only what was really said. [`5cff87b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5cff87b)
- A head turn shows 290 ms behind the camera (it was about 440 ms). A mouth starts moving about 0.25 s after its owner starts talking. [`70b2085`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/70b2085)
- A ring shows whether your face is seen. [`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481). The camera preview says when it can't see a face. [`b34ab75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b34ab75)
- The speech model download: a failure is reported [`b3c649b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b3c649b), and its whole size shows from the start. [`8241d70`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8241d70)
- Words said while the server restarts are retried [`eeb636c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/eeb636c). A page coming back is caught up on the room as it stands. [`4bcaad3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/4bcaad3)
- A natural voice is heard about 0.3 s after the words are said [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f), and 0.2 to 0.4 s after the review's fixes. [`10504a4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/10504a4)
- Typed words go out at each space, as drafts. [`197afe3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/197afe3)
- In Space, a ring goes out from whoever speaks, as far as their loudest word carries. [`197afe3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/197afe3)

### Social presence

- Each person has their own place and colour, chosen by seat and the same on every page. [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c) [`ae57f14`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ae57f14). Joining shows on every page at once. [`01641cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/01641cc)
- Eyes turn to whoever is speaking. [`90dd4fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/90dd4fe). Mouths move with their owner's voice. [`70b2085`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/70b2085)
- Emotes, and reactions to anyone's words [`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe), in the room too. [`859b13f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/859b13f)
- A raised-hand queue: the first in line glows, and a line says who's next. [`d4bff2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d4bff2a)
- Everyone at one table in a 3D room, with the camera leaning towards whoever's talking. [`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650). A light comes up on the speaker. [`50a9cfb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/50a9cfb)
- Being away:
  - a closed tab shows as away, with the head dozing [`174f4cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/174f4cc)
  - someone in the studio doesn't show as away [`123a049`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/123a049)
  - away cards are short [`c211045`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c211045)
  - away people with nothing to say aren't named [`505540e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/505540e)
  - the "here" count corrected [`b74e452`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b74e452)
- Everyone sees you walk [`0023cd6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0023cd6), and others walk the same ways round the furniture. [`990b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/990b708)
- Rooms are groups. Someone who goes to another room leaves the first room's cards rather than showing as away there. [`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9)
- The party: you read whoever you're near, and a loud word carries further. [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)
- Space is the same floor for everyone, so reading goes both ways, and someone new starts clear of everyone. [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)
- "Hear voices": each phrase spoken in the voice its speaker chose. [`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255)

### Trust and privacy

- No audio leaves the browser; only words are sent. [`37b6cfe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/37b6cfe). Only words and numbers are stored. [`9f2f44b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9f2f44b)
- The face: only an emoji leaves the browser [`200bce1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/200bce1), and a note says so [`d6c7ba6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d6c7ba6). Later, only seven numbers leave [`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c). Faces nobody is sending any more are cleared. [`9b71d46`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9b71d46)
- The server log shows a name and four characters, never the id. [`e0386ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e0386ef)
- Who you are comes only from your cookie. [`f08fca8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f08fca8). Editing someone else's words is refused (403). [`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)
- Cross-site POSTs are refused, and names lose zero-width characters. [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)
- A name could put a script on pages drawing flat avatars; it's escaped now. [`357a6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/357a6b0)
- Natural voices: only words go in, and nothing is sent. [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f)
- Where you stand is a place on the floor, kept while you're up and never stored or logged. [`0023cd6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0023cd6)
- Rooms: only whoever made one can change it, and only to looks on offer. The maker is never sent by id. [`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9)
- Space: you can only set your own spot, and names are escaped. [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)
- Tones play no one's voice. [`197afe3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/197afe3)
- Everything chosen is checked on the server against `src/packs.ts`. [`c04f4e4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c04f4e4)

### Accessibility

- Every page has a language, title, viewport, nav, exactly one h1 and alt text. [`1265b84`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1265b84)
- Contrast:
  - quiet words faded no further than 0.6, for 4.5:1 [`32cdec4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/32cdec4)
  - person colours in OKLCH clear 4.5:1 at every hue [`ae57f14`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ae57f14)
  - words over heads keep the dark page's colours on a light page [`0c6b622`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0c6b622)
- Screen readers:
  - a message is read whole [`2b24ed7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2b24ed7)
  - each phrase is read whole, with who said it [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)
  - the cards stay under the room for a screen reader [`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650)
  - typed messages are announced as "(typed)" [`850616c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/850616c)
  - repeated letters are hidden from screen readers [`a26d888`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a26d888)
- Reduced motion:
  - messages are shown whole [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)
  - heads move less [`90dd4fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/90dd4fe)
  - the camera doesn't glide [`a86ead9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a86ead9)
  - the dust is still [`efaf24c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/efaf24c)
- Keyboard:
  - ← and → choose words [`043f36c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/043f36c)
  - Shift+R raises a hand [`d4bff2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d4bff2a)
  - keys turn and zoom the camera [`759d0e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/759d0e3)
- Without the page's script, the hand button still works as a form. [`d4bff2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d4bff2a)
- Phones: recording that works on phones [`c431a2e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c431a2e). A 390 px width without sideways scroll [`1ce0366`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1ce0366). Space is turned on an upright phone. [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)
- Whispers and quiet, sad voices are heard. [`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073) [`c357e2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c357e2a)
- Trialled and not merged: per-reader text size, strength of the drawing, and contrast. [`fd005d2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fd005d2)

### Error tolerance and robustness

- Whisper invents words from silence and noise. The fixes, in order:
  - "My name is Bernoulli." [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)
  - "Thank you." [`dd82631`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/dd82631)
  - a phrase repeated 25 times [`32e17b4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/32e17b4)
  - "Thanks for watching!" [`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481)
  - a lone "You" [`e372665`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e372665)
  - Silero VAD in front of Whisper [`f50b82b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f50b82b)
  - sound labels dropped [`2a43e97`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a43e97)
- Hiss counted as speech [`5681030`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5681030). Words split in two [`0cbcdf4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0cbcdf4). Cuts no longer split a word. [`01641cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/01641cc)
- A worker race sent one phrase's audio with another's words. [`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d)
- A message with "İ" in it took the page down for everyone. [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)
- A bad number in a head (NaN) stopped it drawing. [`c6e6f89`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c6e6f89) [`6e5671b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6e5671b)
- Restarts and reconnects. [`eeb636c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/eeb636c) [`4bcaad3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/4bcaad3) [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)
- Natural voices fall back to the device's own voices. [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f) [`10504a4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/10504a4)
- The voices were heard by your own microphone as you talking. [`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255) [`357a6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/357a6b0) [`3408741`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/3408741)
- GPU memory grew with every slider step and room visit. [`3408741`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/3408741)
- A seat's colour could come to 360. [`91e966e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/91e966e)
- Way-finding ran out of stack and froze the room. [`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9). CI was red for three pushes. [`6c79269`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6c79269)
- Someone who closed their tab while up stood there for good. [`b74e452`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b74e452)
- Rate limits and caps. [`2a43e97`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a43e97) [`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d)

### Learnability

- A newcomer is told about the queue keys and the face. [`34e2e94`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/34e2e94)
- The intro moved behind a "?". [`b34ab75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b34ab75). The help panel shows each step with its own mark. [`409d5fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/409d5fe)
- The type box hint: "*this* stands out" [`850616c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/850616c), fitted to a phone. [`affe7b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/affe7b5)
- Each effect button shows its effect. [`6590dbd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6590dbd)
- Voices are described from measuring them and listed highest first [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f) [`a76ed3a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a76ed3a). Picking one plays it. [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f) [`82bb3ad`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/82bb3ad)
- Turning voices on mentions natural voices and their size [`58f7ec1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/58f7ec1). On a phone, the switch says it uses the small build. [`ba73bff`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ba73bff)
- Reported and left: nothing shows that the tone chips scroll sideways on a phone. [`b74e452`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b74e452)

### Personalisation and expression

- Drawn-out words as "sooo". [`a26d888`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a26d888)
- Effects: Impact, Whisper and Glow [`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566), then eight effects and word styles. [`6590dbd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6590dbd)
- Avatars:
  - looks to choose from [`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c)
  - a builder from packs [`c04f4e4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c04f4e4)
  - saved looks [`4940473`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/4940473)
  - the studio's sliders, extras and undo [`d6827db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d6827db)
  - tops, arms and hands [`81d2090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/81d2090)
- Emotes, reactions, and emotes sent by a big laugh or gasp [`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe). Hand gestures set off emotes. [`81d2090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/81d2090)
- Voices: a choice of voice, with pitch and speed [`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255). 27 natural voices, and any two mixed. [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f) [`a76ed3a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a76ed3a) [`82bb3ad`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/82bb3ad)
- Typed tones: plain, excited, calm, asking, sad, whisper, sarcastic. [`850616c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/850616c)
- How a room looks: six themes and their parts. [`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9)
- Lenses (words, colour, emoji) in Space [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277) and over heads [`197afe3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/197afe3). Tones. [`197afe3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/197afe3)

### Evaluation (how each facet was checked)

- From synthetic voices to real recordings. [`5681030`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5681030) [`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073) [`c357e2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c357e2a) [`dca3a7a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/dca3a7a)
- Independent reviews by subagents. [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e) [`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d) [`9b71d46`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9b71d46) [`357a6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/357a6b0) [`3408741`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/3408741) [`10504a4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/10504a4). A two-hour bug hunt in a browser. [`b74e452`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b74e452)
- Headless sessions of two to seven people at desktop and phone sizes. [`24b4056`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/24b4056) [`4bcaad3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/4bcaad3)
- Frame rates measured with 12 people and a slowed CPU. [`759d0e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/759d0e3) [`e2757f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e2757f5) [`0023cd6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0023cd6) [`990b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/990b708)
- Brynly's own use:
  - "thankyou appears alot" [`dd82631`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/dd82631)
  - "it started bugging out" [`32e17b4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/32e17b4)
  - "its picking up noise and not able to find my face" [`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481)
  - "ok theres a lot more work that needs to be done on that" [`990b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/990b708)
  - "it sucks ..." [`fd005d2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fd005d2)

## 4. Trials of options (tried, measured or built, then kept or let go)

- **AIR.**
  - Tried: a working market with checks in `spec/` and a README (6 to 7 Oct). [`c597051`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c597051) [`e7bf035`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e7bf035) [`f9835e1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f9835e1) [`16bf213`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/16bf213)
  - Showed: what showed it was finished isn't recorded (PROCESS.md gap).
  - Decided: pivot to speech and inflection, 13 Oct. [`9f2f44b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9f2f44b)
- **Whisper tiny.en or base.en.**
  - Showed: tiny placed words up to a second late.
  - Decided: base, at 80 MB rather than 44. [`46d4caf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/46d4caf)
- **How to draw a drawn-out word.**
  - Tried: letter-spacing [`46d4caf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/46d4caf), then repeated letters (Brynly). [`a26d888`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a26d888)
  - Showed: the first steadiness measure was wrong [`a26d888`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a26d888). Two dead ends on real speech, and a looser threshold brought back false repeats. [`5681030`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5681030)
  - Decided: the floor raised after the careful readings in EARS. [`c357e2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c357e2a)
- **The pitch line and the usual voice.**
  - Tried: both as trials. [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)
  - Decided: the pitch line was cut, "get rid of the pitch lines i dont like that". [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)
  - The usual voice's note lost its place, but "the comparison still sizes and weights a phrase" [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c), and typed messages are kept out of it. [`850616c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/850616c)
  - The commit lists "three ways" numbered 1, 2 and 4: Brynly "chose 2 to keep, 1 and 4 to trial". So an option 3 was offered and not taken, and what it was isn't recorded. [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)
- **"Faster / slower".**
  - Tried: as part of the usual-voice note ("Higher, louder and faster than sam usually sounds"). [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)
  - Showed: on 178 CREMA-D takes the pace measures disagreed with each other and with the literature.
  - Decided: never said or drawn. [`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073)
- **The queue.**
  - Tried, in order:
    - a flat second per word, which Brynly chose over a wait that shrinks as it fills [`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566)
    - real time [`e9e6e80`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e9e6e80)
    - an "Up next" column [`b34ab75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b34ab75)
    - a bar along the bottom [`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c)
  - Decided: removed after "get rid of the loading zone ...". Editing became live, on words already sent. [`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)
- **A record of what's been said.**
  - Tried, in order:
    - a preview before sending [`37b6cfe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/37b6cfe)
    - no transcript [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)
    - "Lately" back [`5d099dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d099dd)
    - a text thread per person [`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)
    - newest first [`13a4e40`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/13a4e40)
    - one transcript in the rethink [`fd005d2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fd005d2)
    - Lately dims what's out of reach [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)
- **Emotion from the face.**
  - Tried: six emoji [`200bce1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/200bce1), then a flat avatar that copies the face [`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c), then a 3D head. [`90dd4fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/90dd4fe)
- **The face reader on the GPU or the CPU.**
  - Tried: every frame on the GPU. [`70b2085`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/70b2085)
  - Showed: 143 ms a read there, 12 ms on the CPU.
  - Decided: back on the CPU. [`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481)
- **Cutting phrases at a 0.25 s pause.**
  - Showed: it saved 0.15 s but split words.
  - Decided: dropped. [`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)
- **The three spikes, 22 October** [`2e0f372`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2e0f372). None was run on a phone.
  - Hands in a worker kept the face at speed. Built in [`81d2090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/81d2090).
  - Kokoro: browser voices first, Kokoro opt-in. Built in [`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255).
  - Eight people in a 3D room: the CPU side stayed well over 60 fps slowed 4x, on the Mac's GPU. A phone's GPU is untested. Built in [`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650).
  - The Kokoro spike found only the 163 MB half-size GPU model fast enough. On 4 Nov the half-size GPU builds came out silent, and the full-size 326 MB build was used. [`2e0f372`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2e0f372) [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f)
- **Browser voices or Kokoro.**
  - Tried: the browser's own voices. [`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255)
  - Showed: robotic on many devices and different on each.
  - Decided: Kokoro, opt-in. [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f)
  - Along the way:
    - the half-size GPU builds came out silent [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f)
    - in pieces, "oh this is so good" was heard as "so, gone good", so phrases are said whole [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f)
    - slowing a word made it a slur, so it's drawn out at its own pitch [`e281037`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e281037)
    - phones get the small build [`ba73bff`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ba73bff)
- **Tone curves.**
  - Tried: AgX, ACES and Neutral.
  - Showed: AgX greyed the colours and ACES pushed them orange.
  - Decided: Neutral. [`759d0e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/759d0e3)
- **Shading where things meet (GTAO).**
  - Tried: three strengths, dropped for a grainy halo. [`759d0e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/759d0e3)
  - Decided: back with four settings compared. [`e2757f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e2757f5)
- **Shadow map size.**
  - Showed: 55 fps at 1024, 60 fps at 512.
  - Decided: 512. [`84d0d7f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/84d0d7f)
- **Camera springs.**
  - Showed: springing the camera's position cut through a wall.
  - Decided: the shot and the turn sprung separately. [`e954e9b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e954e9b)
- **Fly suspend.**
  - Tried: asking Fly to suspend the machine rather than stop it. [`75dd8a7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/75dd8a7)
  - Showed: no effect, since a machine with a volume can't be suspended. [`fa84dd5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa84dd5)
  - Decided: start the server lazily, which saved about a tenth of a second locally. Waking still takes about 3 s. [`b3c2ef9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b3c2ef9)
- **Noise gates.** The steps, in order:
  - a syllable-rhythm gate [`c357e2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c357e2a)
  - tightened [`dd82631`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/dd82631)
  - voice against the room's level [`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481)
  - Silero VAD [`f50b82b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f50b82b)
- **Walking.**
  - Tried: Claude offered three ideas; Brynly chose walking. [`0023cd6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0023cd6). A swinging "Me" camera was tried and changed before that commit.
  - Showed: "ok theres a lot more work that needs to be done on that".
  - Decided: "reimagine the whole thing", rebuilt. [`990b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/990b708)
- **The rethink: captions only.**
  - Tried: built without a pause; the rethink's log records Brynly saying "don't ask any questions or pause for anything" ([`aa5eebf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/aa5eebf)). Avatars, the studio, the 3D room, walking, faces, hands, emotes, reactions, effects and styles were removed. The trial's log says "about 7,000 lines"; `git show --stat` gives 1,618 added and 11,087 deleted, 6,196 of them in deleted files. 121 checks, then 123. [`fd005d2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fd005d2) [`aa5eebf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/aa5eebf)
  - Brynly's response: "no i still want the avatars", then the request for "a good purpose".
  - Decided: the party you can read. [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)
- **Space.**
  - Tried: "lets also trial, in a seperate window ...", unlisted at `/r/space/`. [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)
  - Showed: the first version measured from each viewer's own screen, so reading went one way. Fixed before the commit. [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)
  - Still open: whether Space stays (log gap).
- **Colour from a name or from a seat.**
  - Showed: two near-identical pinks.
  - Decided: golden-angle colours by seat. [`ae57f14`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ae57f14)
- **When the speech model downloads.**
  - Tried: on the first press. [`37b6cfe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/37b6cfe)
  - Decided: on arrival, for someone who's joined. [`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d)
- **The phone-width probe.**
  - Showed: comparing with `innerWidth` couldn't catch a 682 px page.
  - Decided: measure against 390. [`1ce0366`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1ce0366)
- **Echo detection.**
  - Showed: replies were dropped as echoes. [`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255)
  - Decided: an echo is now nearly all of one spoken phrase. [`357a6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/357a6b0)

## 5. Gaps only Brynly can fill

Bracketed gaps still in PROCESS.md:

- "[one line on what AIR was]"
- "[Why: what AIR couldn't do that inflection could, and why that was worth more than a working app.]"
- "[Why it went.]" (the pitch line)
- "[Why a log was the wrong thing.]"
- "[Which finding of the CHI 2023 study I disagreed with, and the reason I went the other way.]"
- "[reason]" for accepting the 80 MB download
- "[reason, e.g. one-way flow, simpler than WebSockets]" for server-sent events
- "[reason]" for no build step

Also in PROCESS.md:

- It stops at 13 October. Nothing after crit 9 is there yet.
- "no log" and "The app stopped being a chat room" sit beside "Lately" returning the next day [`5d099dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d099dd) and the 20 Oct "model texting" direction [`b34ab75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b34ab75).
- "make it real time" is quoted as "make the queue go in real time" in the log.
- The usual voice is described as removed, but [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c) says its comparison stayed.

Questions the narrative raises:

- Which insight came from which trial? What did seeing the captions-only version show about what the avatars are for?
- What prompted "get rid of the loading zone" on 20 Oct? Crit 9 feedback, or use?
- What turned "no log" (13 Oct) into "reintroduce a brief record ... for legibility" (14 Oct)?
- On 7 Nov Claude offered "room captions"; Brynly chose walking. On 8 Nov the purpose became captions over heads. Is that link real?
- [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e) lists options 1, 2 and 4, so an option 3 was offered and not taken. What was it, and why not?
- How does a laugh sending an emote by itself [`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe) sit with "inferrable"? (CLAUDE.md says README.md must say why if it stays.)
- Has any spike or feature been tried on a real phone? The log records none.
- What did the crit 9 and crit 10 sessions themselves feed back? The log doesn't record it.
- Which facets were aimed at on purpose, and which surfaced from use?
- Does Space stay? What does README's "What good means" say now?
- What does "goofy" refer to: the look, the features, or the lack of a use?
