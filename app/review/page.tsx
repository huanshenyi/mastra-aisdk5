import { Suspense } from 'react';
import ReviewPageContent from './ReviewPageContent';

export default function ReviewPage() {
    return (
        <Suspense fallback={<div className="max-w-4xl mx-auto p-6 flex items-center justify-center h-[600px]">Loading...</div>}>
            <ReviewPageContent />
        </Suspense>
    );
}
