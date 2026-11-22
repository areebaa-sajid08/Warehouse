import { useCallback, useEffect, useState } from "react";

export function useLoad(loader) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setData(await loader()); }
    catch (err) { setError(err.message || "Unable to load data"); }
    finally { setLoading(false); }
  }, [loader]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setError("");
      }
      return loader();
    }).then((value) => {
      if (active) setData(value);
    }).catch((err) => {
      if (active) setError(err.message || "Unable to load data");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loader]);

  return { data, loading, error, reload, setData };
}
