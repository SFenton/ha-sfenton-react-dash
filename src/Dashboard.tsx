import { Column, Row, TimeCard } from '@hakit/components'
import { useHass } from '@hakit/core'

function Dashboard() {
  const { getAllEntities } = useHass.getState().helpers
  const entityCount = Object.keys(getAllEntities()).length

  return (
    <main className="dashboard-shell">
      <Column fullWidth gap="1rem">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Sfenton Home</p>
            <h1>Dashboard Draft</h1>
          </div>
          <div className="status-pill">{entityCount} entities</div>
        </header>

        <Row gap="1rem" wrap="wrap">
          <section className="panel clock-panel">
            <TimeCard />
          </section>
          <section className="panel planning-panel">
            <h2>Fresh Scaffold</h2>
            <p>
              Connected through HAKit to {import.meta.env.VITE_HA_URL}. This is
              the clean starting point for the new React dashboard.
            </p>
          </section>
        </Row>
      </Column>
    </main>
  )
}

export default Dashboard