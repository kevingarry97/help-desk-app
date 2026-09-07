/** Full-screen loading state shared by the route guards while the session resolves. */
export default function RouteSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="size-8 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
    </div>
  );
}
