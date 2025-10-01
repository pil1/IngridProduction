/**
 * Universal Layout System
 *
 * A comprehensive set of layout components for building consistent,
 * responsive pages with MynaUI styling.
 *
 * @see StandardPageLayout - General-purpose page layout
 * @see TabbedPageLayout - Pages with tab navigation
 * @see DataTableLayout - Data tables with filters and bulk actions
 */

export { StandardPageLayout, GridContainer, SectionContainer } from './StandardPageLayout';
export { TabbedPageLayout, TabPanel } from './TabbedPageLayout';
export { DataTableLayout } from './DataTableLayout';

export type { TabDefinition } from './TabbedPageLayout';