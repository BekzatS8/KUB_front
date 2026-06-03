# Analytics Implementation

## Overview
This document describes the analytics implementation for the CRM platform frontend.

## Features Implemented

### 1. Analytics Page (`/analytics`)
- **Location**: `app/(main)/analytics/page.tsx`
- **Permissions**: Requires `analytics:read` permission
- **Available to**: Admin, Management, Control roles

### 2. Backend Integration
- **API Endpoints**: Uses existing `/reports/*` endpoints
- **Data Models**: Updated in `src/models/reports.model.ts`
- **API Functions**: Enhanced in `src/api/reports.api.ts`

### 3. Visualizations
- **KPI Cards**: Revenue, Deals, Conversion Rate, Leads
- **Sales Funnel**: Bar chart showing deal status distribution
- **Lead Sources**: Pie chart showing lead source distribution
- **Revenue Trend**: Line chart showing revenue over time
- **Top Clients**: List of highest revenue clients

### 4. Features
- **Date Range Selection**: Custom date filtering
- **Period Grouping**: Month, Quarter, Year views
- **Export Functionality**: Download revenue data as Excel
- **Error Handling**: User-friendly error states
- **Loading States**: Smooth loading indicators
- **Responsive Design**: Works on all screen sizes

## Technical Implementation

### Components Used
- Recharts for data visualization
- Shadcn/ui components for UI
- Lucide React for icons
- Custom loading and error states

### Data Flow
1. User selects date range and period
2. Frontend calls backend APIs (`/reports/funnel`, `/reports/leads`, `/reports/revenue`)
3. Data is transformed and visualized
4. KPIs are calculated from the raw data

### Permission System
- Analytics access is controlled through the existing permission system
- `analytics:read` permission required
- Role-based filtering automatically applied by backend

## API Endpoints Used

### GET `/reports/funnel`
- **Params**: `from`, `to`, `period`
- **Returns**: Sales funnel data with status counts

### GET `/reports/leads`
- **Params**: `from`, `to`, `period`
- **Returns**: Lead summary with status and source data

### GET `/reports/revenue`
- **Params**: `from`, `to`, `period`
- **Returns**: Revenue data and top clients

### GET `/reports/revenue/export`
- **Params**: `from`, `to`, `period`
- **Returns**: Excel file download

## Testing
A test utility is available at `src/utils/analytics-test.ts` for debugging API integration.

## Future Enhancements
- Real-time data updates
- Advanced filtering options
- Custom report builder
- Data export in multiple formats
- Comparative analysis (period-over-period)
- Predictive analytics
