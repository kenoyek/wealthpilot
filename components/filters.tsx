export function Filters({
  month,
  scope,
  search = false,
}: {
  month: string;
  scope: string;
  search?: boolean;
}) {
  return (
    <form className="filters" method="get">
      <label>
        Month
        <input
          aria-label="Month"
          type="month"
          name="month"
          defaultValue={month}
          required
        />
      </label>
      <label>
        Scope
        <select aria-label="Scope" name="scope" defaultValue={scope}>
          <option value="all">All finances</option>
          <option value="personal">Personal</option>
          <option value="business">Business</option>
        </select>
      </label>
      {search && (
        <label>
          Search
          <input name="q" placeholder="Description or category" />
        </label>
      )}
      <button className="secondary">Apply filters</button>
    </form>
  );
}
