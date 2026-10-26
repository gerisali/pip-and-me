# Week pack schema (`public/content/weeks/week-XX.json`)

One JSON file per week. The app loads `public/content/index.json` (list of built-in packs);
packs imported from the parent panel are stored on the device and override built-in ones with the same `id`.

```jsonc
{
  "id": "week-01",                 // unique, also used as file name
  "week": 1,
  "level": "starters",             // starters | movers | flyers  (Cambridge YLE; Pre-A1, A1, A2)
  "title": "Hello, Pip!",          // English, shown to the child
  "titleTr": "Merhaba Pip!",       // Turkish, shown in parent panel
  "theme": "Me and my world",
  "goals": {
    "canDo": ["Say my name and age", "..."],          // English, short
    "grammar": ["be: I am / you are / it is", "like / don't like"],
    "phonics": ["short a", "short e", "short i"]
  },
  "vocab": [                       // 20-30 items; Word Lab + model's target words
    { "word": "cat", "emoji": "🐱", "tr": "kedi", "phonics": "short a" }
  ],
  "chunks": [                      // 4-6 formulaic patterns the child should start using
    { "text": "My name is ...", "tr": "Benim adım ...", "example": "My name is Pip." }
  ],
  "talkMissions": [                // 3 per week, one per Talk session
    {
      "id": "w1-t1",
      "title": "Meet Pip",                     // child-facing
      "titleTr": "Pip ile tanış",
      "goal": "Child introduces self: name, age, one thing they like.",   // for the model
      "opener": "Hello! I'm Pip. I'm a fox from planet Zoot. What's your name?",
      "targets": ["My name is ...", "I'm ... years old", "I like ..."],
      "hints": ["My name is ...", "I'm nine.", "I like drawing."]       // shown on 'help' tap
    }
  ],
  "letters": [                     // 2-3 per week; Mailbox
    {
      "id": "w1-l1",
      "subject": "Hello from Zoot!",
      "body": "Dear friend, ...",              // at level; 40-80 words starters, up to 120 movers
      "replyPrompt": "Tell Pip your name, your age and your favourite colour.",
      "replyPromptTr": "Pip'e adını, yaşını ve en sevdiğin rengi yaz.",
      "starters": ["Dear Pip,", "My name is", "I am", "My favourite colour is"],
      "questions": [ { "q": "Where is Pip from?", "options": ["Zoot", "Manisa", "Italy"], "answer": 0 } ]
    }
  ],
  "story": {                       // Story Studio project of the week
    "title": "My home",
    "prompt": "Draw your home and the people and animals who live there.",
    "promptTr": "...",
    "pages": [ { "prompt": "Who lives in your home?", "promptTr": "...", "starters": ["This is my ..."] } ]
  },
  "explorer": [                    // 2 cards per week; non-fiction, animals/nature/science
    {
      "id": "w1-e1", "title": "Foxes", "emoji": "🦊",
      "text": "Foxes are ...",                  // 50-90 words at level
      "facts": ["Foxes have big ears.", "..."],
      "questions": [ { "q": "...", "options": ["..", ".."], "answer": 1 } ]
    }
  ],
  "phonics": [                     // Word Lab 'Sound hunt'
    { "pattern": "short a", "grapheme": "a", "sound": "/æ/", "words": ["cat", "bag", "map", "hat"], "distractors": ["pen", "dog"] }
  ],
  "assessment": {                  // optional; week 1 and every 4th week
    "pictureTask": "Look at the picture and tell Pip what you can see.",
    "pictureEmoji": "🏞️🦊🐦🌳☀️👧"
  }
}
```

Rules for writing content:
- Child-facing English uses only Cambridge YLE wordlist words for the pack's level (plus the week's vocab).
- Sentences short (≤ 10 words at starters, ≤ 14 at movers).
- Turkish fields (`*Tr`, `tr`) are for help/hints and the parent panel; never required to complete a task.
- Themes follow the child's interests: drawing/art, stories, animals, nature, science.
- Recycle: each week re-uses 20-30% vocab/chunks from earlier weeks.
