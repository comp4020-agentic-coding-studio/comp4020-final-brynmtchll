1. What was the breakthrough that moved the work forward?

The breakthrough was testing continually, not just at the end. Every change was checked in the browser against real input: JFK’s speech as the microphone, MediaPipe’s sample portrait as the camera, and a phone-sized page as the second viewer. That caught things I couldn’t have guessed, like a real smile drawing a scowl, and “Thank you.” appearing from near-silence on the live site. A suite of 84 to 92 checks stayed green throughout, so I could keep adding features without breaking what already worked.

2. What did this work change about who I want to be as a software developer?

This work made me want to stay involved in development, whatever tools I use. Claude Opus 5.5 co-authored the commits, but the direction came from me: what to test, which results to trust, and when a fix was wrong (I dropped the 0.25 s pause cut after it split words mid-speech). I want to be the person who understands the system well enough to judge the output, spot the failure in the live logs, and decide what gets built next. Tools can write more of the code, but I want to keep reading it, testing it and shaping it.