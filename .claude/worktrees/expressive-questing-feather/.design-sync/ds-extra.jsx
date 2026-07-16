// Router context for previews/designs — Nav renders react-router <Link>s.
import { MemoryRouter } from "react-router-dom";

export function DSProvider({ children }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}
