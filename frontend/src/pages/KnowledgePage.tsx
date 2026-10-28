import { useEffect, useRef, useState, type FormEvent } from "react";

import { Icon } from "../components/Icon";
import { RichText } from "../components/RichText";
import { UploadZone } from "../components/UploadZone";
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  Field,
  ModeBadge,
  PageHeader,
  Panel,
  RawJson,
  Select,
  Spinner,
  TextArea,
} from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import type { AnalysisEnvelope, KnowledgeResult, Upload } from "../lib/types";
import { useAnalysis } from "../lib/useAnalysis";

const DISCIPLINES = [
  "General construction",
  "Structural engineering",
  "Concrete & formwork",
  "MEP services",
  "Health & safety",
  "Contracts & claims",
  "Planning & scheduling",
];

const SUGGESTIONS = [
  "What causes honeycombing in a concrete column and how do I repair it?",
  "When can I strike formwork from a suspended slab?",
  "How should I sequence waterproofing and screed in a wet area?",
  "What records do I need to support an extension-of-time claim?",
];

interface Exchange {
  question: string;
  envelope: AnalysisEnvelope<KnowledgeResult>;
}

export function KnowledgePage() {
  const { activeProject } = useApp();
  const [question, setQuestion] = useState("");
  const [discipline, setDiscipline] = useState(DISCIPLINES[1]);
  const [files, setFiles] = useState<Upload[]>([]);
  const [history, setHistory] = useState<Exchange[]>([]);
  const pendingQuestion = useRef("");
  const { result, loading, error, run } = useAnalysis<KnowledgeResult>(api.analyze.knowledge);

  useEffect(() => {
    if (!result) return;
    setHistory((current) => [...current, { question: pendingQuestion.current, envelope: result }]);
    setQuestion("");
    setFiles([]);
  }, [result]);

  function ask(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 3) return;
    pendingQuestion.current = trimmed;
    void run({
      question: trimmed,
      project_id: activeProject?.id ?? null,
      discipline,
      image_upload_ids: files.map((file) => file.id),
    });
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Operate · knowledge"
        title="Construction knowledge assistant"
        description="Method-level answers for site questions: what causes a defect, what the correct sequence is, and where the code or safety limit sits."
        actions={
          activeProject ? (
            <Badge tone="accent">
              <Icon name="pin" size={12} /> {activeProject.name}
            </Badge>
          ) : (
            <Badge>No project context</Badge>
          )
        }
      />

      <div className="knowledge-grid">
        <Panel title="Ask" subtitle="Text, an optional detail photograph, and the discipline" className="form-panel">
          <form onSubmit={ask} className="form">
            <Field label="Question">
              <TextArea
                rows={5}
                required
                minLength={3}
                placeholder="Water is seeping through the basement raft at a construction joint. What is the correct repair sequence?"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </Field>

            <Field label="Discipline">
              <Select value={discipline} onChange={(event) => setDiscipline(event.target.value)}>
                {DISCIPLINES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>

            <Field label="Detail photo (optional)">
              <UploadZone files={files} onChange={setFiles} max={1} hint="Upload a detail if it helps explain the question" />
            </Field>

            <Button type="submit" icon="chat" loading={loading} block>
              Ask
            </Button>
            <p className="form-foot">
              Guidance only. Code editions and local requirements override any answer.
            </p>
          </form>

          <div className="suggestions">
            <span className="nav-section">Try one</span>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="suggestion"
                onClick={() => setQuestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </Panel>

        <div className="stack">
          {error && <ErrorNote message={error} />}

          {history.length === 0 && !loading && (
            <Panel>
              <EmptyState
                icon="chat"
                title="No conversation yet"
                body="Ask a construction question to get a structured answer with key points, related topics and the caveats that matter."
              />
            </Panel>
          )}

          {history.map((exchange) => (
            <article className="exchange" key={exchange.envelope.id}>
              <div className="ask-bubble">
                <span className="ask-avatar">
                  <Icon name="target" size={14} />
                </span>
                <p>{exchange.question}</p>
              </div>

              <div className="answer">
                <header className="answer-head">
                  <ModeBadge mode={exchange.envelope.mode} />
                  <span className="muted">
                    confidence {Math.round(exchange.envelope.result.confidence * 100)}%
                  </span>
                </header>

                <RichText text={exchange.envelope.result.answer} />

                {exchange.envelope.result.key_points.length > 0 && (
                  <section className="mini-panel">
                    <h4>Key points</h4>
                    <ul className="list">
                      {exchange.envelope.result.key_points.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="answer-foot">
                  <div>
                    <span className="answer-label">Related</span>
                    <div className="chips">
                      {exchange.envelope.result.related_topics.map((topic) => (
                        <span key={topic} className="chip chip-static">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {exchange.envelope.result.caveats.length > 0 && (
                  <div className="note note-warn">
                    <Icon name="info" size={15} />
                    <span>{exchange.envelope.result.caveats[0]}</span>
                  </div>
                )}

                <RawJson data={exchange.envelope.result} />
              </div>
            </article>
          ))}

          {loading && (
            <div className="panel loading-panel">
              <div className="loading-row">
                <Spinner />
                <div>
                  <strong>Thinking…</strong>
                  <p>Checking the method, the sequence and the safety limits.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
