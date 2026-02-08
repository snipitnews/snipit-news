import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: topics, error } = await getSupabaseAdmin()
      .from('topics')
      .select('name, main_category')
      .eq('is_active', true)
      .order('main_category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by main_category into the { name, subtopics } shape
    type TopicRow = { name: string; main_category: string };
    const typedTopics = (topics || []) as TopicRow[];
    const categoryMap = new Map<string, string[]>();
    for (const topic of typedTopics) {
      const cat = topic.main_category;
      const name = topic.name;
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(name);
    }

    const grouped = Array.from(categoryMap.entries()).map(([name, subtopics]) => ({
      name,
      subtopics,
    }));

    return NextResponse.json({ topics: grouped });
  } catch (error) {
    console.error('Error fetching all topics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
