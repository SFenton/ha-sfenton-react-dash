import { css } from '@emotion/react';
import { ViewHeader, Separator, TodoListCard } from '../components';
import { useNavigation } from '../store';
import { frostedGlass, frostedGlassHover } from '../styles';

const sectionStyles = css`
  margin-bottom: 24px;
`;

const linkGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
`;

const linkCardStyles = css`
  ${frostedGlass};
  ${frostedGlassHover};
  padding: 14px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background 0.2s, transform 0.15s;

  &:active {
    transform: scale(0.97);
  }
`;

const linkIconStyles = css`
  font-size: 18px;
`;

const linkLabelStyles = css`
  font-size: 13px;
  font-weight: 500;
`;

const QUICK_LINKS = [
  { label: 'Groceries', icon: '🛒', route: 'groceries' as const },
  { label: "Stephen's Tasks", icon: '📋', route: 'stephens-chores' as const },
  { label: "Steph's Tasks", icon: '📋', route: 'stephs-chores' as const },
  { label: 'Unassigned', icon: '📦', route: 'unassigned-chores' as const },
  { label: 'Home Tasks', icon: '🏠', route: 'home-improvement-chores' as const },
];

interface TodoSection {
  label: string;
  entityId: string;
}

const STEPHEN_TODOS: TodoSection[] = [
  { label: 'Past Due', entityId: 'todo.stephen_s_past_due_with_unassigned' },
  { label: 'Evening Tasks', entityId: 'todo.stephen_s_evening_with_unassigned' },
  { label: 'Afternoon Tasks', entityId: 'todo.stephen_s_afternoon_with_unassigned' },
  { label: 'Morning Tasks', entityId: 'todo.stephen_s_morning_with_unassigned' },
  { label: 'Due Any Time Today', entityId: 'todo.stephen_s_all_day_with_unassigned' },
  { label: 'No Due Date', entityId: 'todo.stephen_s_no_due_date_with_unassigned' },
  { label: 'Upcoming', entityId: 'todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned' },
];

const STEPH_TODOS: TodoSection[] = [
  { label: 'Evening Tasks', entityId: 'todo.steph_s_evening_with_unassigned' },
  { label: 'Afternoon Tasks', entityId: 'todo.steph_s_afternoon_with_unassigned' },
  { label: 'Morning Tasks', entityId: 'todo.steph_s_morning_with_unassigned' },
  { label: 'Due Any Time Today', entityId: 'todo.steph_s_all_day_with_unassigned' },
  { label: 'No Due Date', entityId: 'todo.steph_s_no_due_date_with_unassigned' },
  { label: 'Upcoming', entityId: 'todo.steph_s_upcoming_today_by_time_and_future_with_unassigned' },
];

export function ChoresView() {
  const { navigate } = useNavigation();

  return (
    <>
      <ViewHeader title="Tasks" />

      <div css={sectionStyles}>
        <Separator title="Quick Links" />
        <div css={linkGridStyles}>
          {QUICK_LINKS.map((link) => (
            <div
              key={link.route}
              css={linkCardStyles}
              onClick={() => navigate(link.route as any)}
            >
              <span css={linkIconStyles}>{link.icon}</span>
              <span css={linkLabelStyles}>{link.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator title="Stephen's Tasks" />
      {STEPHEN_TODOS.map((todo) => (
        <TodoListCard
          key={todo.entityId}
          entityId={todo.entityId}
          title={todo.label}
          hideWhenEmpty
        />
      ))}

      <Separator title="Steph's Tasks" />
      {STEPH_TODOS.map((todo) => (
        <TodoListCard
          key={todo.entityId}
          entityId={todo.entityId}
          title={todo.label}
          hideWhenEmpty
        />
      ))}
    </>
  );
}
