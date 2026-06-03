// Test component to verify analytics API integration
// This can be used for debugging and testing

import * as ReportsAPI from '@/src/api/reports.api';
import type * as Models from '@/src/models/reports.model';

export async function testAnalyticsAPI() {
  try {
    console.log('Testing Analytics API...');
    
    const testParams: Models.ReportsRequest = {
      from: '2024-01-01',
      to: '2024-12-31',
      period: 'month',
    };

    // Test funnel API
    console.log('Testing funnel API...');
    const funnelData = await ReportsAPI.funnel(testParams);
    console.log('Funnel data:', funnelData);

    // Test leads API
    console.log('Testing leads API...');
    const leadsData = await ReportsAPI.leads_summary(testParams);
    console.log('Leads data:', leadsData);

    // Test revenue API
    console.log('Testing revenue API...');
    const revenueData = await ReportsAPI.revenue(testParams);
    console.log('Revenue data:', revenueData);

    return {
      success: true,
      data: {
        funnel: funnelData,
        leads: leadsData,
        revenue: revenueData,
      },
    };
  } catch (error) {
    console.error('Analytics API test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export for use in browser console or for debugging
if (typeof window !== 'undefined') {
  (window as any).testAnalyticsAPI = testAnalyticsAPI;
}
