import { Flame, Chrome, Github } from 'lucide-react';
import { Link } from 'react-router-dom';

function Footer() {
    return (
        <footer className="py-4 border-t border-gray-700">
            <div className="flex flex-col items-center justify-between px-4 mx-auto max-w-7xl sm:flex-row">
                <div className="flex space-x-6">
                    <a href="https://github.com/SSoggy-Group/AI-Chat-Export" target="_blank" rel="noopener noreferrer">
                        <Github className="w-5 h-5 text-gray-400 hover:text-gray-200" />
                    </a>

                </div>
                <Link
                    to="/privacy-policy"
                    className="text-sm text-gray-400 hover:text-gray-200 hover:underline"
                >
                    Privacy Policy
                </Link>
            </div>
        </footer>
    );
}

export default Footer;
