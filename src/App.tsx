import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type QAItem = {
  keywords: string[];
  answer: string;
};

type ChatMessage = {
  id: string;
  sender: string;
  text: string;
  role: "user" | "bot" | "system";
  time: string;
};

type BotLog = {
  id: string;
  time: string;
  username: string;
  message: string;
  botReply: string;
  pointAdded: boolean;
};

const defaultQuestions: QAItem[] = [
  {
    keywords: ["مقال", "ارسل مقال", "المقال"],
    answer: "هذا مثال على مقال تجريبي يتم إرساله بواسطة البوت.",
  },
  {
    keywords: ["النقاط", "ترتيبي"],
    answer: "يمكنك معرفة ترتيبك من لوحة النقاط.",
  },
  {
    keywords: ["السلام عليكم", "هلا", "مرحبا"],
    answer: "وعليكم السلام، أهلاً وسهلاً بك.",
  },
];

const rewardKeywords = ["صحيح", "اجابة صحيحة", "إجابة صحيحة", "فزت", "نقطة"];

const storageKeys = {
  questions: "chat-article-bot-demo:questions",
  points: "chat-article-bot-demo:points",
  logs: "chat-article-bot-demo:logs",
  botEnabled: "chat-article-bot-demo:bot-enabled",
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeId() {
  return crypto.randomUUID();
}

function getTime() {
  return new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function findAnswer(message: string, questions: QAItem[]) {
  const normalized = message.trim().toLowerCase();
  return questions.find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  );
}

function shouldAddPoint(message: string, matchedQuestion?: QAItem) {
  const normalized = message.trim().toLowerCase();
  return Boolean(
    matchedQuestion ||
      rewardKeywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  );
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [botEnabled, setBotEnabled] = useState(() =>
    readStorage(storageKeys.botEnabled, true),
  );
  const [questions, setQuestions] = useState<QAItem[]>(() =>
    readStorage(storageKeys.questions, defaultQuestions),
  );
  const [points, setPoints] = useState<Record<string, number>>(() =>
    readStorage(storageKeys.points, { أحمد: 3, سارة: 2, نورة: 1 }),
  );
  const [logs, setLogs] = useState<BotLog[]>(() =>
    readStorage(storageKeys.logs, []),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      sender: "النظام",
      text: "الغرفة جاهزة. جرّب كتابة: السلام عليكم، مقال، أو النقاط.",
      role: "system",
      time: getTime(),
    },
  ]);
  const [username, setUsername] = useState("زائر");
  const [messageText, setMessageText] = useState("");
  const [jsonInput, setJsonInput] = useState(JSON.stringify(defaultQuestions, null, 2));
  const [newKeywords, setNewKeywords] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [notice, setNotice] = useState("");

  const leaderboard = useMemo(
    () =>
      Object.entries(points)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ar")),
    [points],
  );

  function saveBotEnabled(value: boolean) {
    setBotEnabled(value);
    writeStorage(storageKeys.botEnabled, value);
  }

  function saveQuestions(value: QAItem[]) {
    setQuestions(value);
    writeStorage(storageKeys.questions, value);
  }

  function savePoints(value: Record<string, number>) {
    setPoints(value);
    writeStorage(storageKeys.points, value);
  }

  function saveLogs(value: BotLog[]) {
    setLogs(value);
    writeStorage(storageKeys.logs, value);
  }

  function appendMessage(message: ChatMessage) {
    setMessages((current) => [...current, message]);
  }

  function appendLog(log: BotLog) {
    saveLogs([log, ...logs]);
  }

  function handleSend(event: FormEvent) {
    event.preventDefault();
    const cleanMessage = messageText.trim();
    const cleanUsername = username.trim() || "زائر";
    if (!cleanMessage) return;

    const time = getTime();
    const userMessage: ChatMessage = {
      id: makeId(),
      sender: cleanUsername,
      text: cleanMessage,
      role: "user",
      time,
    };

    appendMessage(userMessage);
    setMessageText("");

    if (!botEnabled) {
      appendLog({
        id: makeId(),
        time,
        username: cleanUsername,
        message: cleanMessage,
        botReply: "البوت متوقف حالياً",
        pointAdded: false,
      });
      return;
    }

    const matched = findAnswer(cleanMessage, questions);
    const botReply = matched?.answer ?? "لم أجد إجابة مناسبة في ملف الأسئلة الحالي.";
    const pointAdded = shouldAddPoint(cleanMessage, matched);

    if (pointAdded) {
      const nextPoints = {
        ...points,
        [cleanUsername]: (points[cleanUsername] ?? 0) + 1,
      };
      savePoints(nextPoints);
    }

    appendMessage({
      id: makeId(),
      sender: "البوت",
      text: botReply,
      role: "bot",
      time: getTime(),
    });

    appendLog({
      id: makeId(),
      time,
      username: cleanUsername,
      message: cleanMessage,
      botReply,
      pointAdded,
    });
  }

  function handleJsonImport() {
    try {
      const parsed = JSON.parse(jsonInput) as QAItem[];
      if (
        !Array.isArray(parsed) ||
        parsed.some(
          (item) =>
            !Array.isArray(item.keywords) ||
            item.keywords.some((keyword) => typeof keyword !== "string") ||
            typeof item.answer !== "string",
        )
      ) {
        throw new Error("Invalid JSON shape");
      }

      saveQuestions(parsed);
      setNotice("تم تحديث ملف الأسئلة بنجاح.");
    } catch {
      setNotice("صيغة JSON غير صحيحة. تأكد من وجود keywords و answer.");
    }
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setJsonInput(String(reader.result ?? ""));
      setNotice("تم تحميل الملف. اضغط حفظ JSON لتطبيقه.");
    };
    reader.readAsText(file);
  }

  function addQuestion() {
    const keywords = newKeywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (!keywords.length || !newAnswer.trim()) {
      setNotice("أدخل كلمة مفتاحية واحدة على الأقل وجواباً واضحاً.");
      return;
    }

    const nextQuestions = [...questions, { keywords, answer: newAnswer.trim() }];
    saveQuestions(nextQuestions);
    setJsonInput(JSON.stringify(nextQuestions, null, 2));
    setNewKeywords("");
    setNewAnswer("");
    setNotice("تمت إضافة السؤال والجواب.");
  }

  function clearLogs() {
    saveLogs([]);
    setNotice("تم مسح السجلات.");
  }

  function resetPoints() {
    savePoints({});
    setNotice("تم تصفير النقاط.");
  }

  function exportLogsTxt() {
    const content =
      logs
        .map(
          (log) =>
            `[${log.time}] المستخدم: ${log.username}\nالرسالة: ${log.message}\nرد البوت: ${log.botReply}\nالنقطة: ${
              log.pointAdded ? "نعم" : "لا"
            }\n`,
        )
        .join("\n") || "لا توجد سجلات بعد.";
    downloadFile("bot-logs.txt", content, "text/plain;charset=utf-8");
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Demo Web App</p>
          <h1>بوت إدارة الشات والمقالات</h1>
          <p>
            ديمو تجريبي لبوت يراقب الشات، يرد تلقائياً، ويدير النقاط.
          </p>
        </div>
        <div className={`status-pill ${botEnabled ? "active" : "paused"}`}>
          {botEnabled ? "البوت يعمل" : "البوت متوقف"}
        </div>
      </section>

      <section className="workspace-grid">
        <section className="panel chat-panel" aria-label="منطقة الشات التجريبية">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">الغرفة التجريبية</span>
              <h2>الشات</h2>
            </div>
            <input
              className="name-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-label="اسم المستخدم"
              placeholder="اسم المستخدم"
            />
          </div>

          <div className="messages-list">
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="message-meta">
                  <strong>{message.sender}</strong>
                  <span>{message.time}</span>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
          </div>

          <form className="chat-form" onSubmit={handleSend}>
            <input
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="اكتب رسالة تجريبية..."
              aria-label="رسالة الشات"
            />
            <button type="submit">إرسال</button>
          </form>
        </section>

        <aside className="panel control-panel" aria-label="لوحة التحكم">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">الإدارة</span>
              <h2>لوحة التحكم</h2>
            </div>
            <span className="inline-status">{botEnabled ? "يعمل" : "متوقف"}</span>
          </div>

          <div className="button-row">
            <button onClick={() => saveBotEnabled(true)} type="button">
              تشغيل البوت
            </button>
            <button className="secondary" onClick={() => saveBotEnabled(false)} type="button">
              إيقاف البوت
            </button>
          </div>

          <label className="field">
            <span>رفع ملف JSON</span>
            <input accept="application/json,.json" onChange={handleFileUpload} type="file" />
          </label>

          <label className="field">
            <span>لصق ملف الأسئلة والأجوبة JSON</span>
            <textarea
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              rows={7}
            />
          </label>
          <button onClick={handleJsonImport} type="button">
            حفظ JSON
          </button>

          <div className="manual-box">
            <h3>إضافة سؤال وجواب</h3>
            <input
              value={newKeywords}
              onChange={(event) => setNewKeywords(event.target.value)}
              placeholder="كلمات مفتاحية مفصولة بفواصل"
            />
            <textarea
              value={newAnswer}
              onChange={(event) => setNewAnswer(event.target.value)}
              placeholder="الجواب الذي سيرسله البوت"
              rows={3}
            />
            <button onClick={addQuestion} type="button">
              إضافة
            </button>
          </div>

          <div className="button-row">
            <button className="danger" onClick={clearLogs} type="button">
              مسح السجلات
            </button>
            <button className="danger-light" onClick={resetPoints} type="button">
              تصفير النقاط
            </button>
          </div>

          {notice && <p className="notice">{notice}</p>}
        </aside>
      </section>

      <section className="lower-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">المنافسة</span>
              <h2>ترتيب اللاعبين</h2>
            </div>
            <button
              className="compact"
              onClick={() =>
                downloadFile(
                  "points.json",
                  JSON.stringify(points, null, 2),
                  "application/json;charset=utf-8",
                )
              }
              type="button"
            >
              تحميل النقاط JSON
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>المركز</th>
                  <th>اسم المستخدم</th>
                  <th>النقاط</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length ? (
                  leaderboard.map((player, index) => (
                    <tr key={player.name}>
                      <td>{index + 1}</td>
                      <td>{player.name}</td>
                      <td>{player.score}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>لا توجد نقاط بعد.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">التتبع</span>
              <h2>السجلات</h2>
            </div>
            <div className="export-actions">
              <button className="compact" onClick={exportLogsTxt} type="button">
                تحميل السجلات TXT
              </button>
              <button
                className="compact"
                onClick={() =>
                  downloadFile(
                    "questions.json",
                    JSON.stringify(questions, null, 2),
                    "application/json;charset=utf-8",
                  )
                }
                type="button"
              >
                تحميل إعدادات الأسئلة JSON
              </button>
            </div>
          </div>

          <div className="logs-list">
            {logs.length ? (
              logs.map((log) => (
                <article className="log-item" key={log.id}>
                  <div>
                    <strong>{log.username}</strong>
                    <span>{log.time}</span>
                  </div>
                  <p>{log.message}</p>
                  <small>رد البوت: {log.botReply}</small>
                  <b className={log.pointAdded ? "point-yes" : "point-no"}>
                    {log.pointAdded ? "تم احتساب نقطة" : "لا توجد نقطة"}
                  </b>
                </article>
              ))
            ) : (
              <p className="empty-state">لا توجد سجلات بعد.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
