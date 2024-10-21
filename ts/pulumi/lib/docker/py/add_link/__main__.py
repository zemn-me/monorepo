"""
This script reads an mtree file and generates a symlink command for a specified content path.
It takes three arguments: the mtree file, the desired link location, and the content path to search for.
"""

import argparse
import re

def parse_mtree(mtree_file, content_path):
    """
    Parses the mtree file to find a line containing the specified content path.
    Returns the matching line if found, otherwise returns None.
    """
    with open(mtree_file, 'r') as file:
        lines = file.readlines()
    return lines

def find_matching_line(lines, content_path):
    """
    Finds the line in the mtree file that contains the specified content path.
    Returns the matching line if found, otherwise returns None.
    """
    for line in lines:
        match = re.search(r'content=(\S+)', line)
        if match and match.group(1) == content_path:
            return line.strip()
    return None

def generate_link_command(link_location, resulting_file_path):
    """
    Generates the link command to create a symbolic link.
    Takes the link location and resulting file path as arguments and returns a formatted string.
    """
    return f'{link_location} uid=0 gid=0 mode=0755 type=link link={resulting_file_path}'

def main():
    """
    Main function that handles command-line arguments, calls parsing, and generates link command.
    Expects named arguments: mtree file path, link location, and content path.
    """
    parser = argparse.ArgumentParser(description='Generate a symlink command from an mtree file.')
    parser.add_argument('--mtree_file', type=str, required=True, help='Path to the mtree file')
    parser.add_argument('--link_location', type=str, required=True, help='Location for the symlink')
    parser.add_argument('--content_path', type=str, required=True, help='Content path to search for in the mtree file')

    args = parser.parse_args()

    lines = parse_mtree(args.mtree_file, args.content_path)
    matched_line = find_matching_line(lines, args.content_path)

    for line in lines:
        print(line.strip())  # Print the original lines of the mtree file

    if matched_line:
        resulting_file_path = matched_line.split()[0]  # Extract the resulting file path from the matched line
        link_command = generate_link_command(args.link_location, resulting_file_path)
        print(link_command)
    else:
        print("Error: No matching content found in the mtree file.")

if __name__ == "__main__":
    main()
