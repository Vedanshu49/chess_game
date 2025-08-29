
  return (
    <div className="container grid md:grid-cols-[minmax(0,1fr)_320px] gap-4 animate-pulse">
      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-6 bg-muted rounded w-1/2 mt-2"></div>
            </div>
            <div className="flex gap-2 items-center">
              <div className="h-8 bg-muted rounded w-24"></div>
              <div className="h-8 bg-muted rounded w-24"></div>
            </div>
          </div>
          <div className="w-full max-w-screen-md mx-auto">
            <div className="rounded-xl overflow-hidden border border-muted">
              <div className="aspect-square bg-muted"></div>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-4 bg-muted rounded w-1/3 mx-auto"></div>
          </div>
          <div className="mt-3">
            <div className="h-10 bg-muted rounded"></div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="h-8 bg-muted rounded w-24"></div>
            <div className="h-8 bg-muted rounded w-24"></div>
            <div className="h-8 bg-muted rounded w-24"></div>
          </div>
        </div>
        <div className="card">
          <div className="h-40 bg-muted rounded"></div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="card">
          <div className="h-6 bg-muted rounded w-1/3 mb-2"></div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
