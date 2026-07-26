# بنك الأسئلة

كل سؤال خاصو يكون بهذا الشكل:

- `id`: معرف فريد
- `question`: نص السؤال
- `answers`: 4 أجوبة
- `correct`: رقم الجواب الصحيح من 0 حتى 3
- `category`: التصنيف
- `difficulty`: easy / medium / hard
- `explanation`: الشرح
- `hint`: التلميح العادي
- `smartHint`: التلميح القوي

مثال:
```json
{
  "id": "q_001",
  "question": "السؤال هنا؟",
  "answers": ["جواب 1", "جواب 2", "جواب 3", "جواب 4"],
  "correct": 1,
  "category": "general",
  "difficulty": "medium",
  "explanation": "الشرح",
  "hint": "تلميح",
  "smartHint": "تلميح قوي"
}
```
