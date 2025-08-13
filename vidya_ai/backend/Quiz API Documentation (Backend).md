# Quiz API Documentation (Backend)

## request
```
curl --location 'http://127.0.0.1:8000/api/quiz/generate' \
--header 'Content-Type: application/json' \
--data '{
    "video_id": "aeio2MFThZg"
}'
```
## response
```
{
    "metadata": {
        "num_questions": 5,
        "difficulty": "medium",
        "language": "en",
        "video_context_excerpt": "yes\nso if one listens to advaita vedanta\ncarefully\nthinks about it one has to everybody has\nto come to this question\nif you're already brahmana if you're\nalready the absolute\nthen what is the purpose of appearing as\na sentient being and going through all\nthese\nstruggles the suffering of life and then\nthe gradual awakening and following the\nspiritual path\nand coming to an enlightenment and\nrealizing that your brahman which you\nalready wear\nso what was the purpose of the whole\nthing\nthe answer is "
    },
    "quiz": [
        {
            "id": "Q1",
            "difficulty": "medium",
            "question": "According to Advaita Vedanta, what fundamental question arises if one is already Brahman?",
            "options": [
                "What is the purpose of appearing as a sentient being and experiencing life's struggles?",
                "How can one achieve enlightenment if they are already the absolute?",
                "What is the difference between Brahman and a sentient being?",
                "Why does the spiritual path involve suffering if the goal is realization?"
            ],
            "answer": "What is the purpose of appearing as a sentient being and experiencing life's struggles?",
            "explanation": "The transcript states, \"if you're already brahmana if you're already the absolute then what is the purpose of appearing as a sentient being and going through all these struggles the suffering of life and then the gradual awakening and following the spiritual path and coming to an enlightenment and realizing that your brahman which you already wear so what was the purpose of the whole thing\"."
        },
        {
            "id": "Q2",
            "difficulty": "medium",
            "question": "According to Swami Vivekananda, why is the question 'What is the purpose of the whole thing?' considered wrong?",
            "options": [
                "Because it implies a need for a logical explanation.",
                "Because it incorrectly assumes a cause is necessary.",
                "Because it suggests that Brahman is incomplete.",
                "Because it is a question that only the enlightened can answer."
            ],
            "answer": "Because it incorrectly assumes a cause is necessary.",
            "explanation": "The speaker explains that Swami Vivekananda would say \"this question itself is wrong\" because \"we are asking for an explanation and what is an explanation it's asking for a cause.\" The question implies a search for a cause where one cannot exist."
        },
        {
            "id": "Q3",
            "difficulty": "medium",
            "question": "In Advaita Vedanta, how is Maya primarily described in relation to the universe?",
            "options": [
                "It is the ultimate reality that causes the universe.",
                "It is the stage, comprising space, time, and causation, upon which the universe appears.",
                "It is the illusion that prevents sentient beings from realizing Brahman.",
                "It is a mystery that can only be understood through enlightenment."
            ],
            "answer": "It is the stage, comprising space, time, and causation, upon which the universe appears.",
            "explanation": "The transcript states, \"this entire cycle of life this game of life it appears because of maya...One way of understanding maya is space time and causation it's like when you have a theatrical performance you need a state so in the theatrical performance of this universe the stage is space-time and causation and this stage is provided by maya\"."
        },
        {
            "id": "Q4",
            "difficulty": "medium",
            "question": "Why is it considered meaningless to ask for the cause of Maya itself?",
            "options": [
                "Because Maya is an abstract concept that cannot have a cause.",
                "Because causality is a component of Maya, making it illogical to seek a cause for it outside of itself.",
                "Because only enlightened beings can understand the true nature of Maya.",
                "Because the answer to Maya's cause is revealed only through spiritual practice."
            ],
            "answer": "Because causality is a component of Maya, making it illogical to seek a cause for it outside of itself.",
            "explanation": "The transcript explains, \"when you have causation as part of the stage, you can't ask for a cause of maya because it's like asking for a cause of causation...The moment you ask for a cause you're already asking for a cause within within maya one can ask for a cause but about maya itself one cannot ask for a cause.\""
        },
        {
            "id": "Q5",
            "difficulty": "medium",
            "question": "According to the transcript, what happens to the fundamental question about life's purpose for those who are enlightened?",
            "options": [
                "They receive a definitive, logical answer to it.",
                "They still ask the question but from a higher perspective.",
                "The question itself dissolves and is no longer a problem.",
                "They explain the answer to others who are seeking."
            ],
            "answer": "The question itself dissolves and is no longer a problem.",
            "explanation": "The transcript states, \"on the side of those who are enlightened they don't seem to ask this question they don't they have the answer but not the question the question is gone and dissolved it it's not a problem to them after enlightenment it's not a problem\"."
        }
    ]
}
```