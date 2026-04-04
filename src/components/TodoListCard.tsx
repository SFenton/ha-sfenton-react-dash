import { css } from '@emotion/react';
import { useEffect, useState } from 'react';
import { useEntity, useHass } from '@hakit/core';
import { Separator } from './Separator';
import { ErrorBoundary } from './ErrorBoundary';
import { frostedGlass } from '../styles';

const cardStyles = css`
  margin-bottom: 16px;
`;

const itemStyles = css`
  ${frostedGlass};
  padding: 12px 14px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s, opacity 0.3s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const checkboxStyles = (checked: boolean) => css`
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid ${checked ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.3)'};
  background: ${checked ? 'rgba(76, 175, 80, 0.3)' : 'transparent'};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s;
`;

const textStyles = css`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const dueStyles = css`
  font-size: 11px;
  opacity: 0.4;
  white-space: nowrap;
`;

const overdueStyles = css`
  font-size: 11px;
  color: rgba(239, 83, 80, 0.9);
  white-space: nowrap;
`;

const emptyStyles = css`
  padding: 16px;
  text-align: center;
  opacity: 0.3;
  font-size: 13px;
`;

const countCardStyles = css`
  ${frostedGlass};
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

interface TodoItem {
  uid: string;
  summary: string;
  status: 'needs_action' | 'completed';
  due?: string;
}

interface TodoListCardProps {
  entityId: string;
  title: string;
  hideWhenEmpty?: boolean;
}

export function TodoListCard({ entityId, title, hideWhenEmpty = false }: TodoListCardProps) {
  return (
    <ErrorBoundary>
      <TodoListInner entityId={entityId} title={title} hideWhenEmpty={hideWhenEmpty} />
    </ErrorBoundary>
  );
}

function TodoListInner({ entityId, title, hideWhenEmpty }: TodoListCardProps) {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [fetched, setFetched] = useState(false);
  const entity = useEntity(entityId);
  const pendingCount = parseInt(entity?.state ?? '0', 10);
  const lastChanged = entity?.last_changed;

  // Fetch items via HA REST API
  useEffect(() => {
    let cancelled = false;

    async function fetchItems() {
      try {
        const { joinHassUrl } = useHass.getState().helpers;
        const state = useHass.getState() as any;
        const token =
          state.connection?.options?.auth?.accessToken ??
          state.helpers?.getConnection?.()?.options?.auth?.accessToken;
        if (!token) return;

        const resp = await fetch(joinHassUrl('/api/services/todo/get_items'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ entity_id: entityId }),
        });

        if (resp.ok) {
          const data = await resp.json();
          // Response shape from HA: { "entity_id": { "items": [...] } }
          // or array of service call results
          const todoItems = extractItems(data, entityId);
          if (!cancelled) {
            setItems(todoItems);
            setFetched(true);
          }
        }
      } catch {
        if (!cancelled) setFetched(true);
      }
    }

    fetchItems();
    return () => { cancelled = true; };
  }, [entityId, lastChanged]);

  if (hideWhenEmpty && pendingCount === 0 && items.length === 0) return null;

  const pending = items.filter((i) => i.status !== 'completed');

  return (
    <div css={cardStyles}>
      <Separator title={`${title}${pendingCount > 0 ? ` (${pendingCount})` : ''}`} />
      {fetched && pending.length > 0 ? (
        pending.map((item) => (
          <TodoItemRow key={item.uid} item={item} entityId={entityId} />
        ))
      ) : fetched && pendingCount > 0 ? (
        <div css={countCardStyles}>
          <span style={{ fontSize: 13 }}>
            {pendingCount} {pendingCount === 1 ? 'task' : 'tasks'} pending
          </span>
        </div>
      ) : fetched ? (
        <div css={emptyStyles}>No tasks ✨</div>
      ) : (
        <div css={emptyStyles}>Loading...</div>
      )}
    </div>
  );
}

function TodoItemRow({ item, entityId }: { item: TodoItem; entityId: string }) {
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const { joinHassUrl } = useHass.getState().helpers;
      const state = useHass.getState() as any;
      const token =
        state.connection?.options?.auth?.accessToken ??
        state.helpers?.getConnection?.()?.options?.auth?.accessToken;
      if (!token) return;

      await fetch(joinHassUrl('/api/services/todo/update_item'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: entityId,
          item: item.uid,
          status: 'completed',
        }),
      });
    } catch {
      // ignore
    }
    setCompleting(false);
  };

  const isOverdue = item.due && new Date(item.due) < new Date();

  return (
    <div
      css={[itemStyles, completing && css`opacity: 0.3;`]}
      onClick={handleComplete}
    >
      <div css={checkboxStyles(false)}>
        {completing && '⏳'}
      </div>
      <span css={textStyles}>{item.summary}</span>
      {item.due && (
        <span css={isOverdue ? overdueStyles : dueStyles}>
          {formatDue(item.due)}
        </span>
      )}
    </div>
  );
}

function extractItems(data: any, entityId: string): TodoItem[] {
  // HA returns different shapes depending on version
  // Shape 1: { "entity_id": { "items": [...] } }
  if (data?.[entityId]?.items) return data[entityId].items;
  // Shape 2: direct array from service call response
  if (Array.isArray(data)) {
    // Could be array of entities' results
    for (const entry of data) {
      if (entry?.[entityId]?.items) return entry[entityId].items;
      if (entry?.items) return entry.items;
    }
  }
  // Shape 3: { items: [...] }
  if (data?.items) return data.items;
  return [];
}

function formatDue(due: string): string {
  try {
    const d = new Date(due);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return due;
  }
}
