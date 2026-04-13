import "./dashboard/dashboard.css"
import {
    BigJobCardSkeleton,
    MapDrawerRowSkeleton,
    RowJobCardSkeleton,
    StackedJobCardSkeleton,
} from "./dashboard/HomepageDashSkeletons"

/** Full-width homepage-style mosaic of skeleton cards (matches web.tsx job homepage patterns). */
export function DashboardMain() {
    return (
        <div className="hp-dash" data-layer="homepage-dashboard">
            <section className="hp-sec" aria-label="Overview mosaic">
                <h2 className="hp-sec-title">Overview</h2>
                <div className="hp-mosaic">
                    <BigJobCardSkeleton
                        borderRadius={32}
                        className="hp-mosaic-tall"
                    />
                    <StackedJobCardSkeleton />
                    <StackedJobCardSkeleton />
                </div>
            </section>

            <section className="hp-sec" aria-label="Metrics">
                <h2 className="hp-sec-title">Metrics</h2>
                <div className="hp-thirds">
                    <BigJobCardSkeleton borderRadius={48} minHeight={234} />
                    <BigJobCardSkeleton borderRadius={48} minHeight={234} />
                    <BigJobCardSkeleton borderRadius={48} minHeight={234} />
                </div>
            </section>

            <section className="hp-sec" aria-label="Activity">
                <h2 className="hp-sec-title">Activity</h2>
                <div className="hp-stack">
                    <StackedJobCardSkeleton />
                    <StackedJobCardSkeleton />
                    <StackedJobCardSkeleton />
                    <StackedJobCardSkeleton />
                </div>
            </section>

            <section className="hp-sec" aria-label="Feed">
                <h2 className="hp-sec-title">Feed</h2>
                <div className="hp-stack">
                    <RowJobCardSkeleton />
                    <RowJobCardSkeleton />
                    <RowJobCardSkeleton />
                    <RowJobCardSkeleton />
                    <RowJobCardSkeleton />
                </div>
            </section>

            <section className="hp-sec" aria-label="Panels">
                <h2 className="hp-sec-title">Panels</h2>
                <div className="hp-map-grid">
                    <MapDrawerRowSkeleton />
                    <MapDrawerRowSkeleton />
                    <MapDrawerRowSkeleton />
                    <MapDrawerRowSkeleton />
                </div>
            </section>

            <section className="hp-sec" aria-label="Highlights">
                <h2 className="hp-sec-title">Highlights</h2>
                <div className="hp-stack hp-highlights">
                    <BigJobCardSkeleton borderRadius={36} className="hp-banner" />
                    <BigJobCardSkeleton borderRadius={36} className="hp-banner" />
                    <BigJobCardSkeleton borderRadius={36} className="hp-banner" />
                </div>
            </section>
        </div>
    )
}
