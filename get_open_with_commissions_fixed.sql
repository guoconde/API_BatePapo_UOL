create or replace function get_open_with_commissions(
  p_from int default 0,
  p_to int default 50,
  p_order text default 'asc'
)
returns json as $$
declare
  today_date date := current_date;
  next_month_date date := (date_trunc('month', current_date) + interval '1 month')::date;
  result json;
  order_clause text;
begin
  -- Garante segurança na ordenação
  if lower(p_order) not in ('asc', 'desc') then
    p_order := 'asc';
  end if;

  order_clause := format('order by ci.due_date %s', p_order);

  execute format($fmt$
    with filtered as (
      select
        ci.id,
        ci.contract_id,
        ci.due_date,
        ci.value,
        ci.tribute,
        ci.installment_number,
        ci.total_installments,
        ci.commission_value,
        row_to_json(c.*) as contract
      from contract_installments ci
      join contracts c on c.id = ci.contract_id
      where ci.paid_at is null
        and ci.due_date >= '%s'::date
        and ci.due_date < '%s'::date
      %s
      offset %s
      limit %s
    ),
    enriched as (
      select json_agg(
        json_build_object(
          'contract_id', f.contract_id,
          'due_date', f.due_date,
          'value', f.value,
          'tribute', f.tribute,
          'installment_number', f.installment_number,
          'total_installments', f.total_installments,
          'commission_value', f.commission_value,
          'contracts', json_build_object(
            'commission', f.contract->>'commission',
            'partners', (
              select row_to_json(p)
              from partners p
              where p.id = (f.contract->>'partner_id')::int
            ),
            'employees01', (
              select row_to_json(e1)
              from employees e1
              where e1.id = (f.contract->>'employee_id_01')::int
            ),
            'employees02', (
              select row_to_json(e2)
              from employees e2
              where e2.id = (f.contract->>'employee_id_02')::int
            )
          )
        )
      ) as data
      from filtered f
    )
    select coalesce(data, '[]'::json) from enriched
  $fmt$, today_date, next_month_date, order_clause, p_from, (p_to - p_from + 1))
  into result;

  return result;
end;
$$ language plpgsql;