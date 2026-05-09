-- 启用 pgvector 扩展
create extension if not exists vector;

-- 删除旧表重建（数据会丢失，需要重新导入）
drop table if exists prompts cascade;

-- 创建提示词表
create table if not exists prompts (
  id text primary key,
  source text not null,
  title text not null,
  description text,
  content_raw text,
  content_json jsonb,
  author text,
  source_link text,
  tags text[],
  text_for_embedding text,
  embedding vector(2048),  -- 豆包 doubao-embedding-vision-251215 是 2048 维
  created_at timestamptz default now()
);

-- 全文搜索索引（fallback）
create index if not exists prompts_search_idx on prompts using gin(to_tsvector('simple', title || ' ' || description || ' ' || coalesce(content_raw, '')));

-- 注：2048 维向量不支持 ivfflat/hnsw 索引，使用顺序扫描
-- 2476 条数据量不大，顺序扫描性能可接受

-- 按来源和标签查询的函数（security definer 允许 anon 用户调用）
create or replace function search_prompts(
  query_embedding vector(2048),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_source text default null,
  filter_tags text[] default null
)
returns table (
  id text,
  source text,
  title text,
  description text,
  content_raw text,
  content_json jsonb,
  author text,
  source_link text,
  tags text[],
  similarity float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    prompts.id,
    prompts.source,
    prompts.title,
    prompts.description,
    prompts.content_raw,
    prompts.content_json,
    prompts.author,
    prompts.source_link,
    prompts.tags,
    1 - (prompts.embedding <=> query_embedding) as similarity
  from prompts
  where 1 - (prompts.embedding <=> query_embedding) > match_threshold
    and (filter_source is null or prompts.source = filter_source)
    and (filter_tags is null or prompts.tags && filter_tags)
  order by prompts.embedding <=> query_embedding
  limit match_count;
end;
$$;
