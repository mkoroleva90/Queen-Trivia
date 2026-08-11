
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";


export default function NotFound() {
    return (
     <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
         <Card className="w-full max-w-md mx-4">
         <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
           <AlertCircle className="h-8 w-8 text-red-500" />
           <h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
           Sorry, we couldn't find the page you were looking for.
          </p>
          <p className="mt-4">
           <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
             ← Back to home
           </Link>
          </p>
         </CardContent>
         </Card>
     </div>
    );
}


