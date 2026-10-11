"""Generate build_en.js (English deck) from build.js by replacing the Azerbaijani string literals.

    python3 make_en.py && NODE_PATH=node_modules PPTX_SKILL=... node build_en.js
"""
from pathlib import Path

HERE = Path(__file__).parent
T = {
    "Açıq çəkili Gemma 4 ilə onlayn mağazalar üçün AI dəstək agenti": "An open-weight Gemma 4 AI support agent for online stores",
    "ChillDesk: Mallard adlı onlayn mağaza üçün AI dəstək agenti. Beyni açıq çəkili Gemma 4-dür. Chat, şəkil və səsli zəng bir yerdədir, söhbətdən sonrakı işlər avtomatik görülür.":
        "ChillDesk is an AI support agent for an online store called Mallard. Its brain is open-weight Gemma 4. Chat, photos and voice calls live in one place, and the follow-up work after each conversation happens automatically.",
    "Müştəri dəstəyi yavaş, baha və dağınıqdır": "Support is slow, costly and scattered",
    "Suallar 24/7 gəlir": "24/7 questions",
    "“Sifarişim haradadır?”, “pulum nə vaxt qayıdır?” — eyni suallar gecə-gündüz təkrarlanır, cavab növbədə gözləyir.":
        "“Where is my order?”, “when do I get my money back?” The same questions repeat day and night while customers wait in a queue.",
    "Şəkil və zəng əl ilə": "Manual checks",
    "Zədəli məhsulun şəkli, telefon zəngi, qəbz — operator hər birinə baxıb sistemdə əl ilə qərar verir.":
        "A damaged-product photo, a phone call, a receipt: an operator checks each one and decides by hand.",
    "Əl ilə hesabat": "Manual wrap-up",
    "Xülasə, kateqoriya, bilet, müştəriyə follow-up email — hər söhbətdən sonra dəqiqələr itir.":
        "Summary, category, ticket and a follow-up email take minutes after every conversation.",
    "Kiçik mağazanın 24/7 dəstək komandası saxlamağa imkanı yoxdur.": "A small store can’t afford a 24/7 support team.",
    "Problem: dəstək sualları təkrarlanır, şəkillər və zənglər əl ilə yoxlanılır, söhbətdən sonra da iş qalır. Kiçik mağaza üçün bu baha başa gəlir.":
        "The problem: support questions repeat, photos and calls are checked by hand, and work remains after each conversation. For a small store that is expensive.",
    "Tanış olun: Aysu": "Meet Aysu",
    "Chat + real hərəkət": "Chat that takes action",
    "Gemma 4 function calling: sifarişi tapır, izləyir, qaytarma və bilet açır": "Gemma 4 function calling: finds and tracks orders, opens returns and tickets",
    "Şəkli görür": "Sees photos",
    "Zədəli məhsulun şəkli → Gemma 4 vision → qərar": "Damaged-product photo → Gemma 4 vision → decision",
    "Səsli zəng, 3D Aysu": "Voice calls, 3D Aysu",
    "Lipsync, tona görə emosiya, Azərbaycan dilində": "Lip sync and tone-driven emotion, in Azerbaijani",
    "Avtomatlaşdırma": "Automation",
    "Xülasə, prioritet, avto-bilet, follow-up email": "Summary, priority, auto-ticket, follow-up email",
    "  ·  Mallard dəstək agenti": "  ·  Mallard support agent",
    "Aysu dörd işi görür: alətlərlə real hərəkət, şəkli anlamaq, 3D avatarla səsli zəng və söhbətdən sonra avtomatlaşdırma.":
        "Aysu does four things: real actions through tools, understanding photos, voice calls with a 3D avatar, and automation after each conversation.",
    "Şəkil göndər, həll al": "Send a photo, get it solved",
    "Müştərinin göndərdiyi şəkil": "The photo the customer sent",
    "Gemma 4 şəkli görür": "Gemma 4 reads the photo",
    "“sol qulaqcıqda çat” → photo_assessment": "“crack on the left ear cup” → photo_assessment",
    "Leyla-nın ML-1042 sifarişini Neon-dan tapır": "Finds Leyla’s order ML-1042 in Neon",
    "Qayda mühərriki: 14 gün + zədə = pulsuz dəyişmə": "Policy engine: 14 days + damage = free replacement",
    "Cavab + müraciət RT-…": "Answer + return RT-…",
    "Kuryer köhnəni götürür, yenisini gətirir": "A courier swaps the old one for a new one",
    "≈13 saniyə · 4 tool çağırışı · 0 operator": "≈13 seconds · 4 tool calls · 0 operators",
    "Canlı ssenari: müştəri çatlı qulaqlığın şəklini göndərir. Gemma 4 şəkli təsvir edir, sifarişi tapır, qayda mühərriki ilə dəyişmə müraciəti açır. Hər addım chat-də görünür.":
        "Live scenario: the customer sends a photo of cracked headphones. Gemma 4 describes the photo, finds the order and opens a replacement through the policy engine. Every step is visible in the chat.",
    "Zəng kimi: səsli Aysu": "Just like a call: voice Aysu",
    "Beyin Gemma 4-dür": "The brain is Gemma 4",
    "ElevenLabs yalnız STT/TTS; cavabı bizim Custom LLM endpoint verir": "ElevenLabs does only STT/TTS; our Custom LLM endpoint writes the answer",
    "Hərf səviyyəsində lipsync": "Character-level lip sync",
    "Hər səs hissəsinin hərf zamanlaması + səsin real gücü": "Per-character timing of every audio chunk + real loudness",
    "Tona görə emosiya": "Emotion follows the tone",
    "[empathetically] səsi də, üzü də dəyişir": "[empathetically] changes both the voice and the face",
    "Real zəng hissi": "Feels like a real call",
    "425 Hz “duut… duut”, qoşulanda Aysu görünür": "425 Hz ringback, Aysu appears when she picks up",
    "Səsli zəng: ElevenLabs səsi tanıyır və səsləndirir, amma cavabı Gemma 4 verir. Avatar hərflərin zamanlaması ilə danışır, Gemma-nın seçdiyi ton tag-i ilə həm səs, həm üz dəyişir.":
        "Voice: ElevenLabs recognizes and speaks, but Gemma 4 writes the answer. The avatar moves its lips to character timings, and the tone tag Gemma picks changes both the voice and the face.",
    "Söhbət bitir, iş özü görülür": "The chat ends, the work gets done",
    "Gemma 4 → JSON": "Gemma 4 → JSON",
    "Xülasə": "Summary",
    "Kateqoriya": "Category",
    "Təcililik": "Urgency",
    "Emosiya": "Sentiment",
    "Həll olundu?": "Resolved?",
    "İnsan lazımdır?": "Needs a human?",
    "Avto-bilet": "Auto-ticket",
    "KB boşluğu": "KB gap",
    "Hər söhbət bitəndə və ya söhbət 10 saniyə sakit qalanda Gemma 4 onu analiz edir: xülasə, prioritet, emosiya, lazım olsa avto-bilet və müştəriyə hazır follow-up email. Hamısı Neon-a yazılır və dashboard-da görünür.":
        "When a conversation ends, or goes quiet for 10 seconds, Gemma 4 analyzes it: summary, priority, sentiment, an auto-ticket if needed, and a ready follow-up email. Everything is written to Neon and shown on the dashboard.",
    "Arxitektura": "Architecture",
    "Brauzer": "Browser",
    "Mallard mağaza · Aysu widget · ChillDesk panel": "Mallard store · Aysu widget · ChillDesk dashboard",
    "/api/chat (SSE) · /v1/chat/completions · avtomatlaşdırma": "/api/chat (SSE) · /v1/chat/completions · automation",
    "Ollama · lokal ehtiyat (429 olanda)": "Ollama · local fallback (on 429)",
    "müştəri, sifariş, qaytarma, bilet, söhbət": "customers, orders, returns, tickets, conversations",
    "lokal RAG · 768-dim": "local RAG · 768-dim",
    "Brauzer chat-i SSE ilə, səsi ElevenLabs ilə göndərir. ElevenLabs bizim OpenAI-uyğun endpoint-i çağırır. Backend Gemma 4 agent dövrəsini işlədir, alətlər Neon-a yazır, bilik bazası EmbeddingGemma və pgvector ilə axtarılır. Gemini limiti dolsa, lokal Gemma 4 davam edir.":
        "The browser sends chat over SSE and voice through ElevenLabs, which calls our OpenAI-compatible endpoint. The backend runs the Gemma 4 agent loop, tools write to Neon, and the knowledge base is searched with EmbeddingGemma and pgvector. If the Gemini quota runs out, local Gemma 4 takes over.",
    "Öz modelimizi öyrətdik: Unsloth QLoRA": "We trained our own model: Unsloth QLoRA",
    "etiketli Azərbaycanca söhbət": "labelled Azerbaijani conversations",
    "parametr — Gemma 3 1B (4-bit)": "parameters — Gemma 3 1B (4-bit)",
    "noutbuk GPU (RTX 4070)": "laptop GPU (RTX 4070)",
    "~ dəq": "~ min",
    "train müddəti": "training time",
    "Etiketləri əvvəlcə seçirik (7 kateqoriya × 3 təcililik × 3 emosiya, 12 məhsul, 6 müştəri üslubu), Gemma 4 26B onlara uyğun söhbət yazır. Ground truth dəqiqdir.":
        "We sample the labels first (7 categories × 3 urgencies × 3 sentiments, 12 products, 6 customer styles), then Gemma 4 26B writes a matching conversation. The ground truth is exact.",
    "Unsloth QLoRA, rank 16, yalnız JSON cavab üzərində loss. Kiçik model bizim etiket qaydalarımızı öyrənir.":
        "Unsloth QLoRA, rank 16, loss on the JSON answer only. The small model learns our labelling rules.",
    "${nTest} gizli test söhbəti: base 1B vs fine-tuned 1B vs Gemma 4 26B. Hər sahə ayrıca ölçülür.":
        "${nTest} held-out conversations: base 1B vs fine-tuned 1B vs Gemma 4 26B. Every field is scored separately.",
    "Məqsəd: söhbət analizini internetsiz, kiçik açıq modeldə işlətmək. Datanı müəllim model yazdı, amma etiketləri biz əvvəlcədən seçdik, ona görə doğru cavablar dəqiq məlumdur.":
        "Goal: run conversation analysis offline on a small open model. A teacher model wrote the data, but we chose the labels up front, so the correct answers are known exactly.",
    "Nəticə: kiçik model, böyük fərq": "Result: small model, big jump",
    "Həll olundu": "Resolved",
    "İnsan lazım": "Needs human",
    "Komanda": "Team",
    "Gemma 3 1B + LoRA (bizim)": "Gemma 3 1B + LoRA (ours)",
    "Test dəqiqliyi, % (gizli test seti)": "Test accuracy, % (held-out set)",
    "fine-tuned 1B orta dəqiqlik": "fine-tuned 1B mean accuracy",
    "eyni model, fine-tune-suz": "same model, not fine-tuned",
    "Gemma 4 26B, zero-shot": "Gemma 4 26B, zero-shot",
    "Gizli test setində eyni 1B model fine-tune-dan əvvəl və sonra, üstəlik 26 milyard parametrli Gemma 4 zero-shot. Fine-tuned kiçik model bizim etiket qaydalarımızı öyrənib və lokal, internetsiz işləyir.":
        "On the held-out set: the same 1B model before and after fine-tuning, plus 26-billion-parameter Gemma 4 zero-shot. The fine-tuned small model learned our labelling rules and runs locally, offline.",
    "Hamısı açıq": "Open all the way down",
    "Agent, vision, analiz": "Agent, vision, analysis",
    "Lokal RAG embedding": "Local RAG embeddings",
    "Fine-tuned analitik": "Fine-tuned analyst",
    "Train və lokal inferens": "Training and local inference",
    "Postgres + vektor axtarışı": "Postgres + vector search",
    "ChillDesk kodu": "ChillDesk code",
    "Bütün AI qatı açıq çəkili Gemma ailəsidir. Kod MIT lisenziyalıdır, README-də modellər, lisenziyalar və işə salma qaydası var.":
        "The whole AI layer is the open-weight Gemma family. The code is MIT; the README lists the models, licenses and how to run it.",
    "Təşəkkürlər!": "Thank you!",
    "İndi Aysuya zəng edək.": "Now let’s call Aysu.",
    "Təşəkkür. Sonra canlı demo: Aysuya zəng, zədəli məhsul şəkli və dashboard-da avtomatik analiz.":
        "Thank you. Next, the live demo: a call to Aysu, a damaged-product photo and the automatic analysis on the dashboard.",
}


def main() -> None:
    src = (HERE / "build.js").read_text()
    out, missing = src, []
    for az, en in sorted(T.items(), key=lambda kv: -len(kv[0])):  # longest first, so short keys can't clip long ones
        hits = 0
        for q in ('"', "`"):
            key = q + az + q
            if key in out:
                out = out.replace(key, q + en.replace(q, "\\" + q) + q)
                hits += 1
        if not hits:
            missing.append(az)
    out = out.replace('path.join(HERE, "ChillDesk.pptx")', 'path.join(HERE, "ChillDesk-EN.pptx")')
    (HERE / "build_en.js").write_text(out)
    print("wrote build_en.js;", "missing:" if missing else "all strings translated", *missing, sep="\n  ")


if __name__ == "__main__":
    main()
