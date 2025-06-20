import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    // Get all available months/years with activity data
    const result = await sql`
      SELECT 
        EXTRACT(YEAR FROM date) as year,
        EXTRACT(MONTH FROM date) as month,
        COUNT(DISTINCT user_fid) as user_count,
        COUNT(*) as activity_count
      FROM daily_activities 
      WHERE steps > 0 OR calories > 0
      GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
      ORDER BY year DESC, month DESC
    `;
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const availableMonths = result.map((row) => ({
      year: parseInt(row.year as string),
      month: parseInt(row.month as string),
      month_name: monthNames[parseInt(row.month as string) - 1],
      display_name: `${monthNames[parseInt(row.month as string) - 1]} ${parseInt(row.year as string)}`,
      user_count: parseInt(row.user_count as string),
      activity_count: parseInt(row.activity_count as string)
    }));

    return NextResponse.json({
      available_months: availableMonths,
      total_periods: availableMonths.length
    });

  } catch (error) {
    console.error('❌ Error fetching available months:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available months' },
      { status: 500 }
    );
  }
} 