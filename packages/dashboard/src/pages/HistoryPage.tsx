import { useEffect, useState } from 'react';
import { api } from '../api';

interface HistoryItem {
  id: string;
  credits: number;
  sourceType: string;
  description: string;
  platform?: string;
  advertiserName?: string;
  title?: string;
  createdAt: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    api.history().then(setHistory);
  }, []);

  return (
    <>
      <h1>History</h1>
      <p className="muted">Every credit event is recorded in the earnings ledger.</p>
      <div className="list">
        {history.map((item) => (
          <div className="row" key={item.id}>
            <div>
              <strong>{item.description}</strong>
              <span>{item.platform || item.sourceType} {item.advertiserName ? `- ${item.advertiserName}` : ''}</span>
            </div>
            <strong className="accent">+{item.credits}</strong>
          </div>
        ))}
        {!history.length && <p className="muted">No earning history yet.</p>}
      </div>
    </>
  );
}
